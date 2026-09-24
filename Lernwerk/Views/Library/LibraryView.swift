import PDFKit
import PhotosUI
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// What the move sheet moves: documents or one folder.
private enum MoveRequest: Identifiable {
    case materials(Set<UUID>)
    case folder(MaterialFolder)

    var id: String {
        switch self {
        case let .materials(ids): return "m" + ids.map(\.uuidString).sorted().joined()
        case let .folder(folder): return "f" + folder.id.uuidString
        }
    }
}

/// A name prompt: a new folder, or renaming a document or folder.
private enum NamePrompt {
    case newFolder
    case renameMaterial(StudyMaterial)
    case renameFolder(MaterialFolder)

    var title: String {
        switch self {
        case .newFolder: return "Neuer Ordner"
        case .renameMaterial: return "Umbenennen"
        case .renameFolder: return "Ordner umbenennen"
        }
    }
}

private struct SubjectRequest: Identifiable {
    var ids: Set<UUID>
    var id: String { ids.map(\.uuidString).sorted().joined() }
}

/// The library: folders like the Files app, search over titles and the text of every PDF, sorting, subjects with
/// colors, favorites, a row to continue reading, selecting several documents at once, drag and drop onto folders
/// and a trash that empties itself after 30 days. Mirrors the Android app.
struct LibraryView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var allMaterials: [StudyMaterial]
    @Query(sort: \MaterialFolder.name) private var folders: [MaterialFolder]
    @AppStorage("librarySort") private var sortRaw = LibrarySort.recent.rawValue

    @State private var folderID: UUID?
    @State private var query = ""
    @State private var subjectFilter: String?
    @State private var favoritesOnly = false
    @State private var showTrash = false
    @State private var selecting = false
    @State private var selected: Set<UUID> = []
    @State private var texts: [String: [String]] = [:]
    @State private var indexed = false

    @State private var isImporting = false
    @State private var errorMessage: String?
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var namePrompt: NamePrompt?
    @State private var nameText = ""
    @State private var moveRequest: MoveRequest?
    @State private var subjectRequest: SubjectRequest?
    @State private var deletingFolder: MaterialFolder?
    @State private var confirmEmptyTrash = false
    @State private var creatingNotebook = false
    @State private var openedNotebook: StudyMaterial?
    @State private var createdNotebook: StudyMaterial?

    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 200), spacing: 28, alignment: .top)]

    private var sort: LibrarySort { LibrarySort(rawValue: sortRaw) ?? .recent }
    private var library: [StudyMaterial] { allMaterials.filter { !$0.isTrashed } }
    private var trash: [StudyMaterial] { allMaterials.filter(\.isTrashed).sorted { ($0.deletedAt ?? .now) > ($1.deletedAt ?? .now) } }
    private var searching: Bool { !query.isBlank }
    private var filtered: Bool { subjectFilter != nil || favoritesOnly }
    private var path: [MaterialFolder] { Library.path(folders, to: folderID?.uuidString) }

    var body: some View {
        ScrollView {
            ContentColumn {
                if showTrash {
                    trashView
                } else if library.isEmpty && folders.isEmpty {
                    emptyState
                } else {
                    content
                }
            }
            .padding(.bottom, selecting ? 90 : 0)
        }
        .scrollIndicators(.hidden)
        .overlay(alignment: .bottom) {
            if selecting { selectionBar }
        }
        .task { purgeExpiredTrash() }
        .task(id: searching) {
            guard searching else { return }
            texts = await MaterialTextIndex.shared.index(library.map(\.fileName))
            indexed = true
        }
        .onChange(of: folders.map(\.id)) { _, ids in
            if let folderID, !ids.contains(folderID) { self.folderID = nil }
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.pdf, .image],
            allowsMultipleSelection: true,
            onCompletion: handleImport
        )
        .alert("Import fehlgeschlagen", isPresented: errorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .alert(namePrompt?.title ?? "", isPresented: namePresented) {
            TextField("Name", text: $nameText)
            Button("Abbrechen", role: .cancel) {}
            Button("Speichern", action: saveName)
        }
        .sheet(item: $moveRequest) { request in
            MoveSheet(folders: folders, request: request) { target in
                move(request, to: target)
                moveRequest = nil
            }
        }
        .sheet(isPresented: $creatingNotebook, onDismiss: {
            // Opens once the sheet is gone; pushing while it is still up does nothing.
            openedNotebook = createdNotebook
            createdNotebook = nil
        }) {
            NotebookSheet(onCreate: createNotebook)
        }
        .navigationDestination(item: $openedNotebook) { material in
            DocumentScreen(material: material)
        }
        .sheet(item: $subjectRequest) { request in
            SubjectSheet { subject in
                for material in library where request.ids.contains(material.id) { material.subject = subject }
                subjectRequest = nil
                endSelection()
            }
        }
        .confirmationDialog("Ordner löschen?", isPresented: deletePresented, titleVisibility: .visible) {
            Button("Löschen", role: .destructive) {
                if let deletingFolder { delete(deletingFolder) }
            }
        } message: {
            Text("„\(deletingFolder?.name ?? "")“ und alle Unterordner werden gelöscht. Die Dokumente darin kommen in den Papierkorb und lassen sich 30 Tage lang wiederherstellen.")
        }
        .confirmationDialog("Papierkorb leeren?", isPresented: $confirmEmptyTrash, titleVisibility: .visible) {
            Button("Endgültig löschen", role: .destructive, action: emptyTrash)
        } message: {
            Text("\(trash.count) Dokumente werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.")
        }
    }

    // Content

    @ViewBuilder
    private var content: some View {
        PageHeader(caption: caption, title: path.last?.name ?? "Bibliothek") {
            HStack(spacing: 10) {
                if selecting {
                    Button("Fertig", action: endSelection)
                        .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                } else {
                    if let current = path.last {
                        Button("Zurück") { folderID = current.parentID }
                            .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                    }
                    Button("Auswählen") { selecting = true }
                        .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                    Menu {
                        Button {
                            creatingNotebook = true
                        } label: {
                            Label("Notizbuch", systemImage: "book.closed")
                        }
                        Button {
                            prompt(.newFolder, text: "")
                        } label: {
                            Label("Ordner", systemImage: "folder.badge.plus")
                        }
                    } label: {
                        Text("Neu")
                            .font(.work(15, .medium))
                            .foregroundStyle(Quill.ink)
                            .padding(.horizontal, 20)
                            .frame(height: 44)
                            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    photosButton
                        .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                    Button("Importieren") { isImporting = true }
                        .buttonStyle(QuillPrimaryButtonStyle())
                }
            }
        }
        .padding(.bottom, 18)
        toolbar
            .padding(.bottom, 24)

        let recent = folderID == nil && !searching && !filtered
            ? Array(library.filter { $0.lastOpenedAt != nil }.sorted { ($0.lastOpenedAt ?? .distantPast) > ($1.lastOpenedAt ?? .distantPast) }.prefix(3))
            : []
        if !recent.isEmpty {
            PixelCaption(text: "Weiterlesen", size: 9).padding(.bottom, 10)
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(recent) { material in
                        NavigationLink(value: Route.document(material, startPage: material.lastOpenedPage, backTitle: "Bibliothek")) {
                            ContinueChip(material: material)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollIndicators(.hidden)
            .padding(.bottom, 28)
        }

        if searching {
            searchResults
        } else {
            let shownFolders = filtered ? [] : folders.filter { $0.parentID == folderID }
            let shownMaterials = filtered
                ? Library.sort(library.filter(matchesFilter), by: sort)
                : Library.sort(library.filter { $0.folderID == folderID }, by: sort)
            if !shownFolders.isEmpty {
                PixelCaption(text: "Ordner", size: 9).padding(.bottom, 10)
                LazyVGrid(columns: columns, alignment: .leading, spacing: 30) {
                    ForEach(shownFolders) { folder in folderTile(folder) }
                }
                .padding(.bottom, 30)
            }
            if !shownMaterials.isEmpty {
                if !shownFolders.isEmpty || !recent.isEmpty {
                    PixelCaption(text: filtered ? "Gefiltert" : "Dokumente", size: 9).padding(.bottom, 10)
                }
                LazyVGrid(columns: columns, alignment: .leading, spacing: 34) {
                    ForEach(shownMaterials) { material in tile(material) }
                }
            }
            if shownFolders.isEmpty && shownMaterials.isEmpty {
                Text(filtered ? "Keine Dokumente mit diesem Filter." : "Dieser Ordner ist leer. Importiere hierher oder zieh Dokumente auf einen Ordner.")
                    .font(.work(15))
                    .foregroundStyle(Quill.faint)
            }
        }

        if folderID == nil && !searching && !trash.isEmpty {
            Button("Papierkorb (\(trash.count))") { showTrash = true }
                .font(.work(14, .medium))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
                .padding(.top, 34)
        }
    }

    private var caption: String {
        if path.isEmpty { return library.count == 1 ? "1 Dokument" : "\(library.count) Dokumente" }
        return (["Bibliothek"] + path.dropLast().map(\.name)).joined(separator: "  ›  ")
    }

    private func matchesFilter(_ material: StudyMaterial) -> Bool {
        (subjectFilter == nil || material.subject == subjectFilter) && (!favoritesOnly || material.isFavorite)
    }

    private var toolbar: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                HStack {
                    TextField("Suchen in Titeln und Texten …", text: $query)
                        .font(.work(15))
                        .foregroundStyle(Quill.ink)
                        .textInputAutocapitalization(.never)
                    if !query.isEmpty {
                        Button("Löschen") { query = "" }
                            .font(.work(13.5))
                            .foregroundStyle(Quill.muted)
                            .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 18)
                .frame(height: 44)
                .background(Quill.surface, in: Capsule())
                .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                Menu {
                    ForEach(LibrarySort.allCases, id: \.self) { option in
                        Button(option.label + (option == sort ? "  ✓" : "")) { sortRaw = option.rawValue }
                    }
                } label: {
                    Text("\(sort.label) ▾")
                        .font(.work(14.5, .medium))
                        .foregroundStyle(Quill.ink)
                        .padding(.horizontal, 14)
                        .frame(height: 44)
                        .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                }
            }
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    filterChip("★ Favoriten", selected: favoritesOnly, color: nil) { favoritesOnly.toggle() }
                    ForEach(Subjects.all.map(\.name).filter { name in library.contains { $0.subject == name } }, id: \.self) { name in
                        filterChip(name, selected: subjectFilter == name, color: Subjects.color(name)) {
                            subjectFilter = subjectFilter == name ? nil : name
                        }
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
    }

    private func filterChip(_ label: String, selected: Bool, color: UInt32?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 7) {
                if let color { Circle().fill(Color(SlideDrawing.uiColor(color))).frame(width: 8, height: 8) }
                Text(label).font(.work(13, .medium)).foregroundStyle(selected ? Quill.bg : Quill.ink)
            }
            .padding(.horizontal, 12)
            .frame(height: 32)
            .background(selected ? Quill.ink : Color.clear, in: Capsule())
            .overlay(Capsule().stroke(selected ? Color.clear : Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var searchResults: some View {
        let hits = Library.search(library, folders: folders, query: query) { texts[$0.fileName] }
        PixelCaption(text: hits.isEmpty ? (indexed ? "Keine Treffer" : "Durchsuche Texte …") : (hits.count == 1 ? "1 Treffer" : "\(hits.count) Treffer"), size: 9)
            .padding(.bottom, 10)
        LazyVGrid(columns: columns, alignment: .leading, spacing: 34) {
            ForEach(hits, id: \.item.id) { hit in
                tile(hit.item, page: hit.page, snippet: hit.snippet.map { "S. \(hit.page ?? 1): \($0)" })
            }
        }
    }

    // Tiles

    @ViewBuilder
    private func tile(_ material: StudyMaterial, page: Int? = nil, snippet: String? = nil) -> some View {
        let tileView = DocumentTile(material: material, snippet: snippet, selecting: selecting, isSelected: selected.contains(material.id))
        if selecting {
            Button { toggle(material.id) } label: { tileView }
                .buttonStyle(TileButtonStyle())
        } else {
            NavigationLink(value: Route.document(material, startPage: page.map { $0 - 1 }, backTitle: "Bibliothek")) { tileView }
                .buttonStyle(TileButtonStyle())
                .draggable(material.id.uuidString) {
                    DocumentTile(material: material, showsCaption: false).frame(width: 120)
                }
                .contextMenu {
                    Button("Umbenennen") { prompt(.renameMaterial(material), text: material.title) }
                    Button("Verschieben …") { moveRequest = .materials([material.id]) }
                    Button("Fach …") { subjectRequest = SubjectRequest(ids: [material.id]) }
                    Button(material.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten") { material.isFavorite.toggle() }
                    Button(role: .destructive) {
                        material.deletedAt = .now
                    } label: {
                        Label("In den Papierkorb", systemImage: "trash")
                    }
                } preview: {
                    DocumentTile(material: material, showsCaption: false)
                        .frame(width: 260)
                        .padding(16)
                        .background(Quill.bg)
                }
        }
    }

    private func folderTile(_ folder: MaterialFolder) -> some View {
        let inside = Library.descendants(folders, of: folder.folderID)
        let count = library.filter { material in material.folderKey.map { inside.contains($0) } ?? false }.count
        return Button {
            if !selecting { folderID = folder.id }
        } label: {
            FolderTile(name: folder.name, count: count)
        }
        .buttonStyle(TileButtonStyle())
        .dropDestination(for: String.self) { ids, _ in
            let uuids = Set(ids.compactMap(UUID.init))
            for material in library where uuids.contains(material.id) { material.folderID = folder.id }
            return !uuids.isEmpty
        }
        .contextMenu {
            Button("Umbenennen") { prompt(.renameFolder(folder), text: folder.name) }
            Button("Verschieben …") { moveRequest = .folder(folder) }
            Button(role: .destructive) {
                deletingFolder = folder
            } label: {
                Label("Löschen", systemImage: "trash")
            }
        }
    }

    // Selection

    private func toggle(_ id: UUID) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    private func endSelection() {
        selecting = false
        selected = []
    }

    private var selectionBar: some View {
        let chosen = library.filter { selected.contains($0.id) }
        let allFavorite = !chosen.isEmpty && chosen.allSatisfy(\.isFavorite)
        return HStack(spacing: 10) {
            Text(selected.count == 1 ? "1 ausgewählt" : "\(selected.count) ausgewählt")
                .font(.work(14.5, .medium))
                .foregroundStyle(Quill.ink)
                .padding(.trailing, 6)
            Group {
                Button("Verschieben") { moveRequest = .materials(selected) }
                Button("Fach") { subjectRequest = SubjectRequest(ids: selected) }
                Button(allFavorite ? "Kein Favorit" : "Favorit") { chosen.forEach { $0.isFavorite = !allFavorite } }
                Button("Papierkorb") {
                    chosen.forEach { $0.deletedAt = .now }
                    endSelection()
                }
            }
            .buttonStyle(QuillOutlineButtonStyle())
            .disabled(selected.isEmpty)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(Quill.surface, in: Capsule())
        .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 6)
        .padding(.bottom, 24)
    }

    // Trash

    @ViewBuilder
    private var trashView: some View {
        PageHeader(caption: "Bibliothek", title: "Papierkorb") {
            HStack(spacing: 10) {
                Button("Zurück") { showTrash = false }
                    .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 15, weight: .medium))
                if !trash.isEmpty {
                    Button("Leeren") { confirmEmptyTrash = true }
                        .buttonStyle(QuillPrimaryButtonStyle())
                }
            }
        }
        Text("Gelöschte Dokumente bleiben \(Library.trashDays) Tage hier und werden dann endgültig entfernt, mit ihren Notizen und Markierungen.")
            .font(.work(14.5))
            .foregroundStyle(Quill.muted)
            .padding(.top, 18)
            .padding(.bottom, 12)
        if trash.isEmpty {
            Text("Der Papierkorb ist leer.").font(.work(15)).foregroundStyle(Quill.faint).padding(.vertical, 14)
        }
        ForEach(trash) { material in
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(material.title).font(.work(15.5)).foregroundStyle(Quill.ink).lineLimit(1)
                    let days = Library.daysLeft(material, now: .now)
                    Text(days == 1 ? "Noch 1 Tag" : "Noch \(days) Tage").font(.work(12.5)).foregroundStyle(Quill.faint)
                }
                Spacer()
                Button("Wiederherstellen") { restore(material) }
                    .buttonStyle(QuillOutlineButtonStyle())
                Button("Endgültig löschen") { deletePermanently(material) }
                    .buttonStyle(QuillOutlineButtonStyle())
            }
            .padding(.vertical, 12)
            .overlay(alignment: .bottom) { QuillDivider() }
        }
    }

    // Actions

    private func prompt(_ prompt: NamePrompt, text: String) {
        nameText = text
        namePrompt = prompt
    }

    private var namePresented: Binding<Bool> {
        Binding(get: { namePrompt != nil }, set: { if !$0 { namePrompt = nil } })
    }

    private var deletePresented: Binding<Bool> {
        Binding(get: { deletingFolder != nil }, set: { if !$0 { deletingFolder = nil } })
    }

    private func saveName() {
        let name = nameText.trimmingCharacters(in: .whitespacesAndNewlines)
        defer { namePrompt = nil }
        guard !name.isEmpty, let prompt = namePrompt else { return }
        switch prompt {
        case .newFolder: modelContext.insert(MaterialFolder(name: name, parentID: folderID))
        case let .renameMaterial(material): material.title = name
        case let .renameFolder(folder): folder.name = name
        }
    }

    private func move(_ request: MoveRequest, to target: UUID?) {
        switch request {
        case let .materials(ids):
            for material in library where ids.contains(material.id) { material.folderID = target }
            endSelection()
        case let .folder(folder):
            // A folder never moves into itself or one of its subfolders.
            let inside = Library.descendants(folders, of: folder.folderID)
            if let target, inside.contains(target.uuidString) { return }
            folder.parentID = target
        }
    }

    /// Removes the folder and its subfolders; the documents inside go to the trash and come back to the top level.
    private func delete(_ folder: MaterialFolder) {
        let removed = Library.descendants(folders, of: folder.folderID)
        for material in allMaterials where material.folderKey.map({ removed.contains($0) }) ?? false {
            material.folderID = nil
            if material.deletedAt == nil { material.deletedAt = .now }
        }
        for item in folders where removed.contains(item.folderID) { modelContext.delete(item) }
        deletingFolder = nil
    }

    /// Back where it was, or to the top level if its folder is gone.
    private func restore(_ material: StudyMaterial) {
        if let id = material.folderID, !folders.contains(where: { $0.id == id }) { material.folderID = nil }
        material.deletedAt = nil
    }

    private func deletePermanently(_ material: StudyMaterial) {
        MaterialStore.delete(fileName: material.fileName)
        modelContext.delete(material)
    }

    private func emptyTrash() {
        trash.forEach(deletePermanently)
    }

    private func purgeExpiredTrash() {
        let now = Date.now
        allMaterials.filter { Library.isExpired($0, now: now) }.forEach(deletePermanently)
    }

    // Import

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Bibliothek")
            Text("Noch kein Material")
                .font(.work(34, .light))
                .tracking(-0.85)
                .foregroundStyle(Quill.ink)
                .padding(.top, 16)
            Text("Importiere Skripte, Arbeitsblätter oder Mitschriften als PDF oder Foto.")
                .font(.work(15.5))
                .lineSpacing(5)
                .foregroundStyle(Quill.muted)
                .padding(.top, 14)
                .padding(.bottom, 30)
            HStack(spacing: 20) {
                Button("PDF importieren") { isImporting = true }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15.5))
                photosButton
                    .buttonStyle(QuillOutlineButtonStyle(height: 48, fontSize: 15.5, weight: .medium))
                Button("Leeres Notizbuch") { creatingNotebook = true }
                    .buttonStyle(QuillOutlineButtonStyle(height: 48, fontSize: 15.5, weight: .medium))
                Button("Demo-Material laden", action: loadDemo)
                    .font(.work(15, .medium))
                    .foregroundStyle(Quill.link)
                    .buttonStyle(.plain)
            }
            if !trash.isEmpty {
                Button("Papierkorb (\(trash.count))") { showTrash = true }
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
                    .buttonStyle(.plain)
                    .padding(.top, 24)
            }
        }
        .frame(maxWidth: 560, alignment: .leading)
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
                    let material = try MaterialStore.importFile(from: url)
                    material.folderID = folderID
                    modelContext.insert(material)
                } catch {
                    errorMessage = error.localizedDescription
                }
            }
        case let .failure(error):
            errorMessage = error.localizedDescription
        }
    }

    /// Photos of worksheets or the board; the Photos app has no share target for apps without an extension.
    private var photosButton: some View {
        PhotosPicker("Aus Fotos", selection: $photoItems, matching: .images)
            .onChange(of: photoItems) { _, items in
                guard !items.isEmpty else { return }
                photoItems = []
                Task { await importPhotos(items) }
            }
    }

    @MainActor
    private func importPhotos(_ items: [PhotosPickerItem]) async {
        let date = Date.now.formatted(.dateTime.day().month(.abbreviated).hour().minute())
        for (index, item) in items.enumerated() {
            do {
                guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                let title = items.count == 1 ? "Foto \(date)" : "Foto \(date) (\(index + 1))"
                let material = try MaterialStore.save(pdfData: MaterialStore.pdf(from: image), title: title)
                material.folderID = folderID
                modelContext.insert(material)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func createNotebook(title: String, paper: PaperStyle) {
        do {
            let material = try MaterialStore.createNotebook(title: title, paper: paper)
            material.folderID = folderID
            modelContext.insert(material)
            createdNotebook = material
        } catch {
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
}

/// A folder drawn from two shapes, with its name and how many documents it holds.
private struct FolderTile: View {
    let name: String
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topLeading) {
                UnevenRoundedRectangle(topLeadingRadius: 8, topTrailingRadius: 8)
                    .fill(Quill.line2)
                    .frame(width: 64, height: 20)
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Quill.surface)
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                    .frame(height: 96)
                    .padding(.top, 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: 120, alignment: .bottom)
            VStack(alignment: .leading, spacing: 3) {
                Text(name)
                    .font(.work(14.5, .medium))
                    .tracking(-0.15)
                    .foregroundStyle(Quill.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(count == 1 ? "1 Dokument" : "\(count) Dokumente")
                    .font(.work(12.5))
                    .foregroundStyle(Quill.faint)
            }
        }
        .contentShape(Rectangle())
    }
}

private struct ContinueChip: View {
    let material: StudyMaterial

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(Subjects.color(material.subject).map { Color(SlideDrawing.uiColor($0)) } ?? Quill.accent)
                .frame(width: 8, height: 8)
            VStack(alignment: .leading, spacing: 1) {
                Text(material.title).font(.work(14, .medium)).foregroundStyle(Quill.ink).lineLimit(1)
                Text("Weiter bei S. \(material.lastOpenedPage + 1)").font(.work(12)).foregroundStyle(Quill.faint)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .frame(maxWidth: 320, alignment: .leading)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
    }
}

/// Picks a target folder, shown as an indented tree; nil is the top level.
private struct MoveSheet: View {
    let folders: [MaterialFolder]
    let request: MoveRequest
    let onMove: (UUID?) -> Void
    @Environment(\.dismiss) private var dismiss

    private var targets: [(folder: MaterialFolder, depth: Int)] {
        var candidates = folders
        if case let .folder(moving) = request {
            candidates = Library.moveTargets(folders, moving: moving.folderID)
        }
        func children(of parent: UUID?, depth: Int) -> [(folder: MaterialFolder, depth: Int)] {
            candidates.filter { $0.parentID == parent }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                .flatMap { folder -> [(folder: MaterialFolder, depth: Int)] in
                    [(folder: folder, depth: depth)] + children(of: folder.id, depth: depth + 1)
                }
        }
        return children(of: nil, depth: 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Verschieben nach").padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 0) {
                    row("Bibliothek (oberste Ebene)", depth: 0, bold: true) { onMove(nil) }
                    ForEach(targets, id: \.folder.id) { entry in
                        row(entry.folder.name, depth: entry.depth, bold: false) { onMove(entry.folder.id) }
                    }
                }
            }
            Button("Abbrechen") { dismiss() }
                .font(.work(15))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
                .padding(.top, 14)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }

    private func row(_ name: String, depth: Int, bold: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if !bold {
                    RoundedRectangle(cornerRadius: 3).fill(Quill.line2).frame(width: 16, height: 12)
                }
                Text(name).font(.work(15.5, bold ? .medium : .regular)).foregroundStyle(Quill.ink)
                Spacer()
            }
            .padding(.leading, CGFloat(depth) * 20 + 2)
            .padding(.vertical, 13)
            .overlay(alignment: .bottom) { QuillDivider() }
            .contentShape(Rectangle())
        }
        .buttonStyle(QuillPressStyle())
    }
}

private struct SubjectSheet: View {
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Fach").padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Subjects.all.map(\.name) + [""], id: \.self) { name in
                        Button { onPick(name) } label: {
                            HStack(spacing: 12) {
                                Circle()
                                    .fill(Subjects.color(name).map { Color(SlideDrawing.uiColor($0)) } ?? Quill.line2)
                                    .frame(width: 10, height: 10)
                                Text(name.isEmpty ? "Kein Fach" : name).font(.work(15.5)).foregroundStyle(Quill.ink)
                                Spacer()
                            }
                            .padding(.vertical, 11)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(QuillPressStyle())
                    }
                }
            }
            Button("Abbrechen") { dismiss() }
                .font(.work(15))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
                .padding(.top, 14)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }
}

/// A document as in the Files and Books apps: the first page as cover, title and details below.
private struct DocumentTile: View {
    let material: StudyMaterial
    var showsCaption = true
    var snippet: String?
    var selecting = false
    var isSelected = false

    @State private var cover: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            coverView
                .frame(maxWidth: .infinity)
                .frame(height: showsCaption ? 210 : nil, alignment: .bottom)
                .overlay(alignment: .topTrailing) {
                    if material.isFavorite {
                        Text("★").font(.system(size: 18)).foregroundStyle(Color(SlideDrawing.uiColor(0xE0A93B))).padding(6)
                    }
                }
                .overlay(alignment: .topLeading) {
                    if selecting {
                        CheckCircle(isOn: isSelected, size: 24)
                            .background(Quill.bg, in: Circle())
                            .padding(8)
                    }
                }
            if showsCaption {
                VStack(alignment: .leading, spacing: 3) {
                    Text(material.title)
                        .font(.work(14.5, .medium))
                        .tracking(-0.15)
                        .foregroundStyle(Quill.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        if let color = Subjects.color(material.subject) {
                            Circle().fill(Color(SlideDrawing.uiColor(color))).frame(width: 7, height: 7)
                        }
                        Text(detail)
                            .font(.work(12.5))
                            .foregroundStyle(Quill.faint)
                            .lineLimit(1)
                    }
                    if let snippet {
                        Text(snippet)
                            .font(.work(12.5))
                            .foregroundStyle(Quill.muted)
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                    }
                }
            }
        }
        .task(id: material.fileName) {
            cover = await DocumentCover.firstPage(of: material.fileURL)
        }
    }

    @ViewBuilder
    private var coverView: some View {
        let border = isSelected ? Quill.accent : Quill.line
        let width: CGFloat = isSelected ? 3 : 1
        if let cover {
            Image(uiImage: cover)
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(border, lineWidth: width))
                .shadow(color: .black.opacity(0.07), radius: 1.5, y: 1)
                .shadow(color: .black.opacity(0.08), radius: 10, y: 6)
        } else {
            RoundedRectangle(cornerRadius: 5, style: .continuous)
                .fill(Quill.surface)
                .aspectRatio(0.707, contentMode: .fit)
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(border, lineWidth: width))
        }
    }

    private var detail: String {
        let added = material.createdAt.formatted(.dateTime.day().month(.abbreviated))
        var parts: [String] = []
        if !material.subject.isEmpty { parts.append(material.subject) }
        parts.append(added)
        if material.lastOpenedPage > 0 { parts.append("S. \(material.lastOpenedPage + 1)") }
        return parts.joined(separator: " · ")
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

/// Title and paper for a new notebook: blank, lined, squared or dotted, like school paper.
private struct NotebookSheet: View {
    let onCreate: (String, PaperStyle) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var paper: PaperStyle = .lined
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 0) {
                PixelCaption(text: "Titel")
                TextField("z. B. Mathe Mitschrift", text: $title)
                    .font(.work(18))
                    .focused($focused)
                    .submitLabel(.done)
                    .onSubmit(create)
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Quill.line2, lineWidth: 1))
                    .padding(.top, 10)
                PixelCaption(text: "Papier")
                    .padding(.top, 26)
                HStack(spacing: 14) {
                    ForEach(PaperStyle.allCases) { style in
                        Button {
                            paper = style
                        } label: {
                            VStack(spacing: 8) {
                                Image(uiImage: PaperRenderer.preview(style, width: 92))
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 76)
                                    .clipShape(RoundedRectangle(cornerRadius: 4))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 4)
                                            .strokeBorder(paper == style ? Quill.accent : Quill.line2, lineWidth: paper == style ? 2.5 : 1)
                                    )
                                Text(style.label)
                                    .font(.work(13.5, paper == style ? .semibold : .regular))
                                    .foregroundStyle(paper == style ? Quill.ink : Quill.muted)
                            }
                        }
                        .buttonStyle(QuillPressStyle())
                    }
                }
                .padding(.top, 12)
                Spacer(minLength: 0)
            }
            .padding(24)
            .background(Quill.bg)
            .navigationTitle("Neues Notizbuch")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Erstellen", action: create)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onAppear { focused = true }
    }

    private func create() {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = "Notizbuch " + Date.now.formatted(.dateTime.day().month(.abbreviated))
        onCreate(name.isEmpty ? fallback : name, paper)
        dismiss()
    }
}
