import PDFKit
import SwiftUI
import UIKit

/// The state of the document toolbar and the commands behind its buttons; the controller does the work on the
/// pages.
@MainActor
final class NoteEditorModel: ObservableObject {
    @Published var tool: NoteTool = .read {
        didSet {
            if tool == .pen || tool == .highlighter || tool == .shapes { lastWritingTool = tool }
            push()
        }
    }
    @Published var settings = InkSettings() {
        didSet { push() }
    }
    @Published var zoomActive = false {
        didSet { controller?.setZoom(zoomActive) }
    }
    @Published private(set) var controller: NotesController?
    @Published private(set) var currentPage = 0
    @Published private(set) var canUndo = false
    @Published private(set) var canRedo = false
    @Published private(set) var bookmarks: Set<Int> = []
    @Published private(set) var isEditingText = false
    @Published private(set) var loadFailed = false

    let material: StudyMaterial
    var onMark: ((MarkedRegion) -> Void)?
    private var lastWritingTool: NoteTool = .pen

    init(material: StudyMaterial) {
        self.material = material
    }

    var pageCount: Int { controller?.document.pageCount ?? 0 }

    /// The paper for new pages: the notebook's own, blank for PDFs.
    var defaultPaper: PaperStyle { PaperStyle(rawValue: material.paper) ?? .blank }

    func load(startPage: Int) {
        guard controller == nil, !loadFailed else { return }
        open(startPage: startPage)
    }

    private func open(startPage: Int) {
        guard let document = PDFDocument(url: material.fileURL), document.pageCount > 0 else {
            loadFailed = true
            return
        }
        let page = min(max(startPage, 0), document.pageCount - 1)
        let controller = NotesController(document: document, fileName: material.fileName, startPage: page)
        controller.onPageChange = { [weak self] page in
            MainActor.assumeIsolated {
                self?.currentPage = page
                self?.material.lastOpenedPage = page
            }
        }
        controller.onUndoChange = { [weak self] undo, redo in
            MainActor.assumeIsolated {
                self?.canUndo = undo
                self?.canRedo = redo
            }
        }
        controller.onMark = { [weak self] region in
            MainActor.assumeIsolated { self?.onMark?(region) }
        }
        controller.onNotesChange = { [weak self] notes in
            MainActor.assumeIsolated { self?.bookmarks = notes.bookmarks }
        }
        controller.onEditingChange = { [weak self] editing in
            MainActor.assumeIsolated { self?.isEditingText = editing }
        }
        controller.onZoomClosed = { [weak self] in
            MainActor.assumeIsolated { self?.zoomActive = false }
        }
        controller.apply(tool: tool, settings: settings)
        bookmarks = controller.notes.bookmarks
        currentPage = page
        canUndo = false
        canRedo = false
        self.controller = controller
        if zoomActive { controller.setZoom(true) }
    }

    private func push() {
        controller?.apply(tool: tool, settings: settings)
    }

    func close() {
        controller?.saveNow()
    }

    // Toolbar commands

    func toggleReadMode() {
        tool = tool == .read ? lastWritingTool : .read
    }

    func toggleZoom() {
        zoomActive.toggle()
        if zoomActive, !tool.writesInZoom { tool = lastWritingTool }
    }

    func undo() { controller?.undo() }

    func redo() { controller?.redo() }

    func toggleBookmark(_ page: Int? = nil) {
        controller?.toggleBookmark(page ?? currentPage)
    }

    func go(to page: Int) { controller?.go(to: page) }

    func go(to selection: PDFSelection) { controller?.go(to: selection) }

    func insertImage(_ image: UIImage) {
        controller?.insertImage(image)
        tool = .lasso
    }

    func insertSticker(_ text: String) {
        controller?.insertSticker(text)
        tool = .lasso
    }

    /// Inserts a page of paper after `page` and opens the document there; the controller is rebuilt because every
    /// later page's ink and notes move by one.
    func insertPage(after page: Int? = nil, paper: PaperStyle) {
        let index = page ?? currentPage
        controller?.saveNow()
        guard MaterialStore.insertPage(in: material, after: index, paper: paper) else { return }
        reopen(at: index + 1)
    }

    /// Inserts a PDF file's pages after `page` and opens the document there.
    func insertPDF(from source: URL, after page: Int? = nil) {
        let index = page ?? currentPage
        controller?.saveNow()
        guard MaterialStore.insertPDF(from: source, in: material, after: index) else { return }
        reopen(at: index + 1)
    }

    /// Inserts a picture as a new page after `page`, fit to the document's page size.
    func insertImagePage(_ image: UIImage, after page: Int? = nil) {
        let index = page ?? currentPage
        controller?.saveNow()
        guard MaterialStore.insertImagePage(image, in: material, after: index) else { return }
        reopen(at: index + 1)
    }

    func deletePage(_ page: Int) {
        controller?.saveNow()
        guard MaterialStore.deletePage(in: material, at: page) else { return }
        reopen(at: max(0, page - 1))
    }

    private func reopen(at page: Int) {
        controller = nil
        open(startPage: page)
    }

    /// The PDF with everything written on it, or the original, as a file to share.
    func exportFile(flattened: Bool) -> URL? {
        guard let controller else { return nil }
        controller.saveNow()
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let name = material.title.components(separatedBy: CharacterSet(charactersIn: "/\\:?*\"<>|")).joined().trimmingCharacters(in: .whitespaces)
        let url = directory.appendingPathComponent("\(name.isEmpty ? "Dokument" : name).pdf")
        let data = flattened
            ? NotesExporter.flattenedPDF(document: controller.document, fileName: material.fileName)
            : (try? Data(contentsOf: material.fileURL))
        guard let data, (try? data.write(to: url, options: .atomic)) != nil else { return nil }
        return url
    }
}
