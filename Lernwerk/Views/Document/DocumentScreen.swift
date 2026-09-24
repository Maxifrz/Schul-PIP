import PDFKit
import PhotosUI
import SwiftData
import SwiftUI

/// A PDF or notebook with a GoodNotes-style toolbar: the document row on top, the tools below it and the options of
/// the selected tool next to them.
struct DocumentScreen: View {
    let material: StudyMaterial
    let startPage: Int?
    let backTitle: String

    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.scenePhase) private var scenePhase
    @Query private var topics: [PlanTopic]
    @Query private var cards: [ReviewCard]

    @StateObject private var editor: NoteEditorModel
    @State private var tutor: TutorSession?
    @State private var sheet: DocumentSheet?
    @State private var exported: ExportedFile?
    @State private var photoItem: PhotosPickerItem?
    @State private var isRenaming = false
    @State private var draftTitle = ""
    @State private var pageToDelete: Int?

    init(material: StudyMaterial, startPage: Int? = nil, backTitle: String = "Bibliothek") {
        self.material = material
        self.startPage = startPage
        self.backTitle = backTitle
        _editor = StateObject(wrappedValue: NoteEditorModel(material: material))
    }

    private var isRegular: Bool { sizeClass == .regular }

    var body: some View {
        VStack(spacing: 0) {
            topBar
            toolBar
            HStack(spacing: 0) {
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Quill.canvas)
                if isRegular, let tutor {
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
        .sheet(item: $sheet) { sheet in
            switch sheet {
            case .pages:
                PageGridSheet(editor: editor, onDelete: { pageToDelete = $0 })
            case .search:
                DocumentSearchSheet(editor: editor)
            case .stickers:
                StickerSheet { editor.insertSticker($0) }
            }
        }
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
        .alert("Umbenennen", isPresented: $isRenaming) {
            TextField("Titel", text: $draftTitle)
            Button("Abbrechen", role: .cancel) {}
            Button("Sichern") {
                let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                if !title.isEmpty { material.title = title }
            }
        }
        .confirmationDialog(
            "Seite \((pageToDelete ?? 0) + 1) löschen?",
            isPresented: deletePresented,
            titleVisibility: .visible
        ) {
            Button("Seite löschen", role: .destructive) {
                if let page = pageToDelete { editor.deletePage(page) }
                pageToDelete = nil
            }
            Button("Abbrechen", role: .cancel) { pageToDelete = nil }
        } message: {
            Text("Die Seite verschwindet samt allem, was darauf geschrieben ist.")
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            photoItem = nil
            Task { await insertPhoto(item) }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { editor.close() }
        }
        .task {
            material.lastOpenedAt = .now
            editor.onMark = { region in openTutor(region) }
            editor.load(startPage: startPage ?? material.lastOpenedPage)
        }
        .onDisappear { editor.close() }
    }

    // MARK: - Document row

    private var topBar: some View {
        HStack(spacing: 2) {
            Button(action: leave) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 17, weight: .medium))
                    if isRegular {
                        Text(backTitle)
                            .font(.work(15))
                            .foregroundStyle(Quill.muted)
                            .lineLimit(1)
                    }
                }
                .foregroundStyle(Quill.ink)
                .padding(.horizontal, 8)
                .frame(height: 40)
                .contentShape(Rectangle())
            }
            .buttonStyle(QuillPressStyle())
            .accessibilityLabel("Zurück")

            if isRegular {
                BarButton(icon: "square.grid.2x2", label: "Seitenübersicht") { sheet = .pages }
                BarButton(icon: "magnifyingglass", label: "Suchen") { sheet = .search }
                shareMenu
            }

            titleButton
                .frame(maxWidth: .infinity)

            BarButton(icon: "arrow.uturn.backward", label: "Rückgängig", isEnabled: editor.canUndo) { editor.undo() }
            BarButton(icon: "arrow.uturn.forward", label: "Wiederholen", isEnabled: editor.canRedo) { editor.redo() }
            if isRegular {
                BarButton(
                    icon: editor.bookmarks.contains(editor.currentPage) ? "bookmark.fill" : "bookmark",
                    label: "Lesezeichen",
                    tint: editor.bookmarks.contains(editor.currentPage) ? Quill.warn : Quill.ink
                ) { editor.toggleBookmark() }
                addPageMenu
            }
            BarButton(
                icon: editor.tool == .read ? "pencil.slash" : "pencil",
                label: editor.tool == .read ? "Schreiben" : "Nur lesen",
                isActive: editor.tool == .read
            ) { editor.toggleReadMode() }
            moreMenu
        }
        .padding(.horizontal, 8)
        .padding(.top, 4)
        .padding(.bottom, 2)
    }

    private var titleButton: some View {
        Button {
            draftTitle = material.title
            isRenaming = true
        } label: {
            VStack(spacing: 1) {
                HStack(spacing: 5) {
                    Text(material.title)
                        .font(.work(15.5, .medium))
                        .foregroundStyle(Quill.ink)
                        .lineLimit(1)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Quill.faint)
                }
                if editor.pageCount > 0 {
                    PixelCaption(text: "Seite \(editor.currentPage + 1) / \(editor.pageCount)", size: 9)
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(QuillPressStyle())
        .accessibilityLabel("Titel ändern")
    }

    private var shareMenu: some View {
        Menu {
            Button {
                export(flattened: true)
            } label: {
                Label("PDF mit Notizen", systemImage: "doc.richtext")
            }
            Button {
                export(flattened: false)
            } label: {
                Label("Original-PDF", systemImage: "doc")
            }
        } label: {
            BarIcon(icon: "square.and.arrow.up")
        }
        .accessibilityLabel("Teilen")
    }

    private var addPageMenu: some View {
        Menu {
            Section("Seite danach einfügen") {
                ForEach(PaperStyle.allCases) { paper in
                    Button {
                        editor.insertPage(paper: paper)
                    } label: {
                        Label(paper.label, systemImage: paper.icon)
                    }
                }
            }
        } label: {
            BarIcon(icon: "doc.badge.plus")
        }
        .accessibilityLabel("Seite hinzufügen")
    }

    private var moreMenu: some View {
        Menu {
            if !isRegular {
                Button {
                    sheet = .pages
                } label: {
                    Label("Seitenübersicht", systemImage: "square.grid.2x2")
                }
                Button {
                    sheet = .search
                } label: {
                    Label("Suchen", systemImage: "magnifyingglass")
                }
                Button {
                    editor.toggleBookmark()
                } label: {
                    Label(
                        editor.bookmarks.contains(editor.currentPage) ? "Lesezeichen entfernen" : "Lesezeichen setzen",
                        systemImage: editor.bookmarks.contains(editor.currentPage) ? "bookmark.slash" : "bookmark"
                    )
                }
                Menu {
                    ForEach(PaperStyle.allCases) { paper in
                        Button(paper.label) { editor.insertPage(paper: paper) }
                    }
                } label: {
                    Label("Seite einfügen", systemImage: "doc.badge.plus")
                }
                Menu {
                    Button("PDF mit Notizen") { export(flattened: true) }
                    Button("Original-PDF") { export(flattened: false) }
                } label: {
                    Label("Teilen", systemImage: "square.and.arrow.up")
                }
                Divider()
            }
            Button {
                draftTitle = material.title
                isRenaming = true
            } label: {
                Label("Umbenennen", systemImage: "character.cursor.ibeam")
            }
            Button {
                material.isFavorite.toggle()
            } label: {
                Label(material.isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten", systemImage: material.isFavorite ? "star.slash" : "star")
            }
            Button(role: .destructive) {
                pageToDelete = editor.currentPage
            } label: {
                Label("Diese Seite löschen", systemImage: "trash")
            }
            .disabled(editor.pageCount <= 1)
        } label: {
            BarIcon(icon: "ellipsis.circle")
        }
        .accessibilityLabel("Mehr")
    }

    // MARK: - Tool row

    @ViewBuilder
    private var toolBar: some View {
        let options = ToolOptions(editor: editor)
        Group {
            if isRegular {
                HStack(spacing: 10) {
                    toolButtons
                    Rectangle()
                        .fill(Quill.line)
                        .frame(width: 1, height: 26)
                    ScrollView(.horizontal, showsIndicators: false) {
                        options
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        toolButtons
                    }
                    ScrollView(.horizontal, showsIndicators: false) {
                        options
                    }
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Quill.surface)
        .overlay(alignment: .top) { QuillDivider(color: Quill.lineSoft) }
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
        .disabled(editor.controller == nil)
    }

    private var toolButtons: some View {
        HStack(spacing: 2) {
            ToolButton(icon: "plus.magnifyingglass", label: "Zoom-Fenster", isOn: editor.zoomActive) { editor.toggleZoom() }
            ToolButton(icon: "pencil.tip", label: "Stift", isOn: editor.tool == .pen) { editor.tool = .pen }
            ToolButton(icon: "eraser", label: "Radierer", isOn: editor.tool == .eraser) { editor.tool = .eraser }
            ToolButton(icon: "highlighter", label: "Textmarker", isOn: editor.tool == .highlighter) { editor.tool = .highlighter }
            ToolButton(icon: "square.on.circle", label: "Formen", isOn: editor.tool == .shapes) { editor.tool = .shapes }
            ToolButton(icon: "lasso", label: "Lasso", isOn: editor.tool == .lasso) { editor.tool = .lasso }
            ToolButton(icon: "star.circle", label: "Sticker", isOn: false) { sheet = .stickers }
            PhotosPicker(selection: $photoItem, matching: .images) {
                BarIcon(icon: "photo", size: 17)
                    .frame(width: 40, height: 36)
            }
            .accessibilityLabel("Bild einfügen")
            ToolButton(icon: "keyboard", label: "Tippen", isOn: editor.tool == .typing) { editor.tool = .typing }
            ToolButton(icon: "character.textbox", label: "Textfeld", isOn: editor.tool == .textBox) { editor.tool = .textBox }
            ToolButton(icon: "wand.and.rays", label: "Laserpointer", isOn: editor.tool == .laser) { editor.tool = .laser }
            Button {
                editor.tool = editor.tool == .mark ? .read : .mark
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 13, weight: .semibold))
                    Text("Pip fragen")
                        .font(.work(13.5, .medium))
                }
                .foregroundStyle(editor.tool == .mark ? Quill.onAccent : Quill.ink)
                .padding(.horizontal, 12)
                .frame(height: 32)
                .background(Capsule().fill(editor.tool == .mark ? Quill.accent : Quill.hover))
            }
            .buttonStyle(QuillPressStyle())
            .padding(.leading, 6)
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if let controller = editor.controller {
            NotesCanvas(controller: controller)
                .id(ObjectIdentifier(controller))
        } else if editor.loadFailed {
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

    // MARK: - Actions

    private var compactTutorPresented: Binding<Bool> {
        Binding(
            get: { !isRegular && tutor != nil },
            set: { isPresented in
                if !isPresented { closeTutor() }
            }
        )
    }

    private var deletePresented: Binding<Bool> {
        Binding(
            get: { pageToDelete != nil },
            set: { isPresented in
                if !isPresented { pageToDelete = nil }
            }
        )
    }

    private func leave() {
        editor.close()
        closeTutor()
        dismiss()
    }

    private func export(flattened: Bool) {
        guard let url = editor.exportFile(flattened: flattened) else { return }
        exported = ExportedFile(url: url)
    }

    private func insertPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else { return }
        editor.insertImage(image)
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

enum DocumentSheet: String, Identifiable {
    case pages, search, stickers

    var id: String { rawValue }
}

/// The document canvas the controller owns; a new controller gets a new view.
struct NotesCanvas: UIViewRepresentable {
    let controller: NotesController

    func makeUIView(context: Context) -> NotesContainerView {
        controller.container
    }

    func updateUIView(_ view: NotesContainerView, context: Context) {}
}

// MARK: - Tool options

/// Pen type, widths and colors, eraser mode, text style: whatever the selected tool can be set to.
private struct ToolOptions: View {
    @ObservedObject var editor: NoteEditorModel

    var body: some View {
        HStack(spacing: 10) {
            switch editor.tool {
            case .pen, .shapes:
                penKindMenu
                widths(InkSettings.penWidths, selected: editor.settings.penWidth, dot: 3.2) { editor.settings.penWidth = $0 }
                colors(InkSettings.penColors, selected: editor.settings.penColor) { editor.settings.penColor = $0 }
                if editor.tool == .shapes {
                    hint("Zeichne frei: Linien, Kreise, Rechtecke und Vielecke werden automatisch sauber.")
                }
            case .highlighter:
                widths(InkSettings.highlighterWidths, selected: editor.settings.highlighterWidth, dot: 0.55) { editor.settings.highlighterWidth = $0 }
                colors(InkSettings.highlighterColors, selected: editor.settings.highlighterColor) { editor.settings.highlighterColor = $0 }
            case .eraser:
                Picker("Radierer", selection: $editor.settings.eraserPixel) {
                    Text("Ganze Striche").tag(false)
                    Text("Pixel").tag(true)
                }
                .pickerStyle(.segmented)
                .frame(width: 210)
                if editor.settings.eraserPixel {
                    widths(InkSettings.eraserWidths, selected: editor.settings.eraserWidth, dot: 0.45) { editor.settings.eraserWidth = $0 }
                }
            case .typing, .textBox:
                textStyleMenu
                alignment
                colors(InkSettings.penColors, selected: editor.settings.textColor) { editor.settings.textColor = $0 }
                if !editor.isEditingText {
                    hint(editor.tool == .typing ? "Tippe auf die Seite, um zu schreiben." : "Tippe auf die Seite für ein Textfeld.")
                }
            case .lasso:
                hint("Striche einkreisen zum Verschieben. Texte, Bilder und Sticker antippen und ziehen, gedrückt halten für mehr.")
            case .laser:
                hint("Zum Zeigen: Die Spur verblasst nach dem Loslassen.")
            case .mark:
                hint("Zieh einen Rahmen um die Stelle, bei der Pip helfen soll.")
            case .read:
                hint("Nur lesen: Blättern und Zoomen, nichts wird verändert.")
            }
        }
        .frame(height: 36)
        .animation(.easeInOut(duration: 0.15), value: editor.tool)
    }

    private var penKindMenu: some View {
        Menu {
            Picker("Stift", selection: $editor.settings.penKind) {
                ForEach(PenKind.allCases) { kind in
                    Text(kind.label).tag(kind)
                }
            }
        } label: {
            HStack(spacing: 5) {
                Text(editor.settings.penKind.label)
                    .font(.work(13.5, .medium))
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .foregroundStyle(Quill.ink)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(Capsule().fill(Quill.hover))
        }
    }

    private var textStyleMenu: some View {
        Menu {
            Picker("Stil", selection: $editor.settings.textStyle) {
                ForEach(NoteTextStyle.allCases, id: \.self) { style in
                    Text(style.label).tag(style)
                }
            }
        } label: {
            HStack(spacing: 5) {
                Text(editor.settings.textStyle.label)
                    .font(.work(13.5, editor.settings.textStyle.isBold ? .semibold : .medium))
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
            }
            .foregroundStyle(Quill.ink)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(Capsule().fill(Quill.hover))
        }
    }

    private var alignment: some View {
        HStack(spacing: 0) {
            ForEach(NoteTextAlign.allCases, id: \.self) { align in
                Button {
                    editor.settings.textAlign = align
                } label: {
                    Image(systemName: align.icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(editor.settings.textAlign == align ? Quill.ink : Quill.faint)
                        .frame(width: 32, height: 30)
                        .background(RoundedRectangle(cornerRadius: 7).fill(editor.settings.textAlign == align ? Quill.hover : .clear))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func widths(_ values: [CGFloat], selected: CGFloat, dot: CGFloat, set: @escaping (CGFloat) -> Void) -> some View {
        HStack(spacing: 2) {
            ForEach(values, id: \.self) { value in
                Button {
                    set(value)
                } label: {
                    Circle()
                        .fill(Quill.ink)
                        .frame(width: min(18, max(4, value * dot)), height: min(18, max(4, value * dot)))
                        .frame(width: 32, height: 30)
                        .background(RoundedRectangle(cornerRadius: 7).fill(selected == value ? Quill.hover : .clear))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func colors(_ values: [UInt32], selected: UInt32, set: @escaping (UInt32) -> Void) -> some View {
        HStack(spacing: 6) {
            ForEach(values, id: \.self) { value in
                Button {
                    set(value)
                } label: {
                    Circle()
                        .fill(Color(QuillUIColor.hex(value)))
                        .frame(width: 22, height: 22)
                        .overlay(Circle().strokeBorder(Quill.line2, lineWidth: 1))
                        .padding(3)
                        .overlay(Circle().strokeBorder(selected == value ? Quill.ink : .clear, lineWidth: 1.5))
                }
                .buttonStyle(.plain)
            }
            ColorPicker(
                "Eigene Farbe",
                selection: Binding(
                    get: { Color(QuillUIColor.hex(selected)) },
                    set: { set(UIColor($0).hexValue) }
                ),
                supportsOpacity: false
            )
            .labelsHidden()
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.work(12.5))
            .foregroundStyle(Quill.faint)
            .lineLimit(1)
            .fixedSize()
    }
}

// MARK: - Buttons

/// An icon in the document row.
private struct BarIcon: View {
    let icon: String
    var size: CGFloat = 17
    var tint: Color = Quill.ink

    var body: some View {
        Image(systemName: icon)
            .font(.system(size: size, weight: .regular))
            .foregroundStyle(tint)
            .frame(width: 40, height: 40)
            .contentShape(Rectangle())
    }
}

private struct BarButton: View {
    let icon: String
    let label: String
    var isEnabled = true
    var isActive = false
    var tint: Color = Quill.ink
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            BarIcon(icon: icon, tint: isEnabled ? (isActive ? Quill.link : tint) : Quill.hint)
                .background(RoundedRectangle(cornerRadius: 9).fill(isActive ? Quill.hover : .clear).padding(3))
        }
        .buttonStyle(QuillPressStyle())
        .disabled(!isEnabled)
        .accessibilityLabel(label)
    }
}

/// A tool in the tool row; the selected one sits on a soft accent background.
private struct ToolButton: View {
    let icon: String
    let label: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: isOn ? .semibold : .regular))
                .foregroundStyle(isOn ? Quill.link : Quill.ink)
                .frame(width: 40, height: 36)
                .background(RoundedRectangle(cornerRadius: 9).fill(isOn ? Quill.accent.opacity(0.18) : .clear))
                .contentShape(Rectangle())
        }
        .buttonStyle(QuillPressStyle())
        .accessibilityLabel(label)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

extension PaperStyle {
    var icon: String {
        switch self {
        case .blank: return "doc"
        case .lined: return "list.dash"
        case .grid: return "grid"
        case .dotted: return "circle.grid.3x3"
        }
    }
}

extension NoteTextAlign {
    var icon: String {
        switch self {
        case .left: return "text.alignleft"
        case .center: return "text.aligncenter"
        case .right: return "text.alignright"
        }
    }
}

extension UIColor {
    /// The color as 0xRRGGBB.
    var hexValue: UInt32 {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        func channel(_ value: CGFloat) -> UInt32 { UInt32(min(max(value, 0), 1) * 255 + 0.5) }
        return channel(red) << 16 | channel(green) << 8 | channel(blue)
    }
}
