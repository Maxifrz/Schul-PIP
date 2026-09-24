import PDFKit
import PencilKit
import SwiftUI

// MARK: - Page overview

/// All pages as thumbnails with their notes: jump, bookmark, insert and delete pages.
struct PageGridSheet: View {
    @ObservedObject var editor: NoteEditorModel
    let onDelete: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var onlyBookmarks = false
    @State private var thumbnails: [Int: UIImage] = [:]
    @State private var drawings: [Int: PKDrawing] = [:]
    @State private var notes = DocumentNotes()

    private var pages: [Int] {
        let all = Array(0..<editor.pageCount)
        return onlyBookmarks ? all.filter { editor.bookmarks.contains($0) } : all
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                if pages.isEmpty {
                    Text(onlyBookmarks ? "Noch keine Lesezeichen. Setz eins über das Lesezeichen-Symbol oben." : "Keine Seiten.")
                        .font(.work(15))
                        .foregroundStyle(Quill.muted)
                        .multilineTextAlignment(.center)
                        .padding(40)
                } else {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 128, maximum: 190), spacing: 18)], spacing: 22) {
                        ForEach(pages, id: \.self) { index in
                            cell(index)
                        }
                    }
                    .padding(20)
                }
            }
            .background(Quill.bg)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Anzeigen", selection: $onlyBookmarks) {
                        Text("Alle Seiten").tag(false)
                        Text("Lesezeichen").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 240)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
        .task(id: editor.controller.map { ObjectIdentifier($0) }) {
            thumbnails = [:]
            drawings = editor.controller?.currentDrawings ?? [:]
            notes = editor.controller?.notes ?? DocumentNotes()
        }
    }

    private func cell(_ index: Int) -> some View {
        let isCurrent = index == editor.currentPage
        return VStack(spacing: 8) {
            Button {
                editor.go(to: index)
                dismiss()
            } label: {
                thumbnail(index)
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .strokeBorder(isCurrent ? Quill.accent : Quill.line2, lineWidth: isCurrent ? 2.5 : 1)
                    )
                    .overlay(alignment: .topTrailing) {
                        if editor.bookmarks.contains(index) {
                            Image(systemName: "bookmark.fill")
                                .font(.system(size: 15))
                                .foregroundStyle(Quill.warn)
                                .padding(6)
                        }
                    }
                    .shadow(color: .black.opacity(0.08), radius: 4, y: 2)
            }
            .buttonStyle(QuillPressStyle())
            .contextMenu {
                Button {
                    editor.toggleBookmark(index)
                } label: {
                    Label(
                        editor.bookmarks.contains(index) ? "Lesezeichen entfernen" : "Lesezeichen setzen",
                        systemImage: editor.bookmarks.contains(index) ? "bookmark.slash" : "bookmark"
                    )
                }
                Menu {
                    ForEach(PaperStyle.allCases) { paper in
                        Button(paper.label) { editor.insertPage(after: index, paper: paper) }
                    }
                } label: {
                    Label("Seite danach einfügen", systemImage: "doc.badge.plus")
                }
                Button(role: .destructive) {
                    dismiss()
                    onDelete(index)
                } label: {
                    Label("Seite löschen", systemImage: "trash")
                }
                .disabled(editor.pageCount <= 1)
            }
            Text("\(index + 1)")
                .font(.work(13, isCurrent ? .semibold : .regular))
                .foregroundStyle(isCurrent ? Quill.ink : Quill.muted)
        }
    }

    private func thumbnail(_ index: Int) -> some View {
        let box = editor.controller?.document.page(at: index)?.bounds(for: .cropBox).size ?? PaperRenderer.a4
        return ZStack {
            Color.white
            if let image = thumbnails[index] {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            }
        }
        .aspectRatio(box.width / max(box.height, 1), contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .task(id: index) {
            guard thumbnails[index] == nil, let document = editor.controller?.document else { return }
            thumbnails[index] = NotesExporter.thumbnail(document: document, index: index, drawings: drawings, notes: notes, width: 360)
        }
    }
}

// MARK: - Search

/// Finds words in the PDF text and in typed notes.
struct DocumentSearchSheet: View {
    @ObservedObject var editor: NoteEditorModel

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var hits: [SearchHit] = []
    @State private var searched = false
    @FocusState private var focused: Bool

    struct SearchHit: Identifiable {
        let id = UUID()
        let page: Int
        let snippet: String
        let selection: PDFSelection?
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Quill.faint)
                    TextField("Im Dokument suchen", text: $query)
                        .font(.work(16))
                        .focused($focused)
                        .submitLabel(.search)
                        .autocorrectionDisabled()
                    if !query.isEmpty {
                        Button {
                            query = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(Quill.hint)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
                .frame(height: 42)
                .background(RoundedRectangle(cornerRadius: 10).fill(Quill.hover))
                .padding(16)

                if hits.isEmpty {
                    Spacer()
                    Text(searched ? "Nichts gefunden." : "Mindestens zwei Zeichen eingeben.")
                        .font(.work(15))
                        .foregroundStyle(Quill.muted)
                    Spacer()
                } else {
                    List(hits) { hit in
                        Button {
                            open(hit)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                PixelCaption(text: hit.selection == nil ? "Seite \(hit.page + 1) · Notiz" : "Seite \(hit.page + 1)")
                                Text(highlighted(hit.snippet))
                                    .font(.work(14))
                                    .foregroundStyle(Quill.ink2)
                                    .lineLimit(3)
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(Quill.bg)
                    }
                    .listStyle(.plain)
                }
            }
            .background(Quill.bg)
            .navigationTitle(hits.isEmpty ? "Suchen" : "\(hits.count) Treffer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
        .onAppear { focused = true }
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            search()
        }
    }

    private func search() {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 2, let controller = editor.controller else {
            hits = []
            searched = false
            return
        }
        let document = controller.document
        var found: [SearchHit] = []
        for selection in document.findString(text, withOptions: [.caseInsensitive, .diacriticInsensitive]).prefix(300) {
            guard let page = selection.pages.first else { continue }
            let context = (selection.copy() as? PDFSelection) ?? selection
            context.extend(atStart: 40)
            context.extend(atEnd: 70)
            found.append(SearchHit(page: document.index(for: page), snippet: Self.clean(context.string ?? text), selection: selection))
        }
        for note in controller.notes.annotations where note.kind == .text && note.text.localizedStandardContains(text) {
            found.append(SearchHit(page: note.page, snippet: Self.clean(note.text), selection: nil))
        }
        hits = found.sorted { $0.page < $1.page }
        searched = true
    }

    private func open(_ hit: SearchHit) {
        if let selection = hit.selection {
            editor.go(to: selection)
        } else {
            editor.go(to: hit.page)
        }
        dismiss()
    }

    private func highlighted(_ snippet: String) -> AttributedString {
        var attributed = AttributedString(snippet)
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty, let range = attributed.range(of: text, options: [.caseInsensitive, .diacriticInsensitive]) {
            attributed[range].font = Font.work(14, .semibold)
            attributed[range].backgroundColor = Color(QuillUIColor.warn).opacity(0.28)
        }
        return attributed
    }

    private static func clean(_ text: String) -> String {
        text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }
}

// MARK: - Stickers

struct StickerSheet: View {
    let onPick: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    PixelCaption(text: "Etiketten")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 118), spacing: 10)], spacing: 10) {
                        ForEach(Stickers.labels, id: \.text) { label in
                            Button {
                                pick(label.text)
                            } label: {
                                Text(label.text)
                                    .font(.work(14, .semibold))
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 38)
                                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(QuillUIColor.hex(label.color))))
                            }
                            .buttonStyle(QuillPressStyle())
                        }
                    }
                    PixelCaption(text: "Symbole")
                        .padding(.top, 8)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 54), spacing: 8)], spacing: 8) {
                        ForEach(Stickers.symbols, id: \.self) { symbol in
                            Button {
                                pick(symbol)
                            } label: {
                                Text(symbol)
                                    .font(.system(size: 30))
                                    .frame(width: 54, height: 54)
                                    .background(RoundedRectangle(cornerRadius: 10).fill(Quill.hover))
                            }
                            .buttonStyle(QuillPressStyle())
                        }
                    }
                }
                .padding(20)
            }
            .background(Quill.bg)
            .navigationTitle("Sticker")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func pick(_ text: String) {
        onPick(text)
        dismiss()
    }
}
