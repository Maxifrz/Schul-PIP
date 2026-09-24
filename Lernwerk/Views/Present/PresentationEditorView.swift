import PDFKit
import PhotosUI
import SwiftData
import SwiftUI

private enum EditorDrag {
    case idle
    case move(SlideElement, tappedSelected: Bool)
    case resize(SlideElement, SlideGeometry.Corner)
    case lineEnd(SlideElement, start: Bool)
    case rotate(SlideElement)
}

struct PresentationEditorView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var store: PresentationStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model: PresentationEditorModel
    @StateObject private var assistant: AssistantState

    @State private var busy: String?
    @State private var errorMessage: String?
    @State private var isAssistantOpen: Bool
    @State private var assistantTab: AssistantTab
    @State private var exported: ExportedFile?
    @State private var isPresenting = false
    @State private var isRenaming = false
    @State private var renameText = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var isPickingPage = false

    init(presentation: Presentation, store: PresentationStore, openAssistant: AssistantTab? = nil) {
        _model = StateObject(wrappedValue: PresentationEditorModel(presentation) { store.update($0) })
        _assistant = StateObject(wrappedValue: AssistantState(materialIDs: presentation.materialIds))
        _isAssistantOpen = State(initialValue: openAssistant != nil)
        _assistantTab = State(initialValue: openAssistant ?? .chat)
    }

    private var images: [String: UIImage] { store.images(for: model.presentation.slides) }

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(backTitle: "Präsentation", title: model.presentation.title, onBack: leave) {
                HStack(spacing: 8) {
                    if let busy {
                        HStack(spacing: 8) {
                            PulsingDots()
                            Text(busy).font(.work(13)).foregroundStyle(Quill.faint)
                        }
                    }
                    Button(isAssistantOpen ? "Assistent ✓" : "Assistent") {
                        model.finishEditing()
                        isAssistantOpen.toggle()
                    }
                    .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                    Menu {
                        Button("Sprechernotizen schreiben") {
                            runAI("Sprechernotizen") { assistant in
                                model.replacePresentation(try await assistant.speakerNotes(model.presentation))
                            }
                        }
                        Button("Chat: Änderungen ansagen") { openAssistant(.chat) }
                        Button("Kritiker") { openAssistant(.critic) }
                        Button("Feedback zur Präsentation") { openAssistant(.feedback) }
                    } label: { menuLabel("KI") }
                    .disabled(busy != nil)
                    Menu {
                        Button("PowerPoint (.pptx)") { export(pptx: true) }
                        Button("PDF") { export(pptx: false) }
                    } label: { menuLabel("Export") }
                    .disabled(busy != nil)
                    Menu {
                        Button("Umbenennen") {
                            renameText = model.presentation.title
                            isRenaming = true
                        }
                        Menu("Redezeit: \(model.presentation.minutes) min") {
                            ForEach([3, 5, 7, 10, 12, 15, 20, 30, 45], id: \.self) { minutes in
                                Button("\(minutes) Minuten") { model.setMinutes(minutes) }
                            }
                        }
                    } label: { menuLabel("Mehr") }
                    Button("Präsentieren") {
                        model.finishEditing()
                        isPresenting = true
                    }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 14))
                }
            }
            if let errorMessage {
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    StatusDot(color: Quill.warn)
                    Text(errorMessage).font(.work(14)).foregroundStyle(Quill.ink2)
                    Spacer()
                    Button("Schließen") { self.errorMessage = nil }
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                        .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 8)
            }
            HStack(spacing: 0) {
                slideList
                    .frame(width: 172)
                Rectangle().fill(Quill.line).frame(width: 1)
                VStack(spacing: 0) {
                    insertBar
                    EditorCanvasView(model: model, images: images)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    inspector
                    notesBar
                }
                .background(Quill.canvas)
                if isAssistantOpen {
                    Rectangle().fill(Quill.line).frame(width: 1)
                    AssistantPanel(model: model, state: assistant, tab: $assistantTab) { isAssistantOpen = false }
                        .frame(width: 380)
                        .transition(.move(edge: .trailing))
                }
            }
        }
        .background(Quill.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
        .fullScreenCover(isPresented: $isPresenting) {
            PresentView(presentation: model.presentation, images: images, startIndex: model.slideIndex)
        }
        .sheet(isPresented: $isPickingPage) {
            MaterialPagePicker { image in
                isPickingPage = false
                insertPicture(image)
            }
        }
        .alert("Umbenennen", isPresented: $isRenaming) {
            TextField("Titel", text: $renameText)
            Button("Abbrechen", role: .cancel) {}
            Button("Speichern") { model.rename(renameText) }
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            photoItem = nil
            Task { @MainActor in
                guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
                    errorMessage = "Das Bild lässt sich nicht öffnen."
                    return
                }
                insertPicture(image)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: isAssistantOpen)
    }

    private func menuLabel(_ title: String) -> some View {
        Text("\(title) ▾")
            .font(.work(13.5, .medium))
            .foregroundStyle(Quill.ink)
            .padding(.horizontal, 14)
            .frame(height: 34)
            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
    }

    private func openAssistant(_ tab: AssistantTab) {
        model.finishEditing()
        assistantTab = tab
        isAssistantOpen = true
    }

    private func leave() {
        model.finishEditing()
        dismiss()
    }

    private func runAI(_ label: String, _ task: @escaping @MainActor (PresentationAssistant) async throws -> Void) {
        guard busy == nil else { return }
        model.finishEditing()
        busy = label
        errorMessage = nil
        let assistant = PresentationAssistant(client: settings.makeClient(for: .tutor))
        Task { @MainActor in
            defer { busy = nil }
            do {
                try await task(assistant)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func export(pptx: Bool) {
        model.finishEditing()
        let presentation = model.presentation
        let data = pptx
            ? PptxWriter.write(presentation) { store.mediaData($0) }
            : SlideDrawing.pdf(presentation, images: images)
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let name = presentation.title.components(separatedBy: CharacterSet(charactersIn: "/\\:?*\"<>|")).joined().trimmingCharacters(in: .whitespaces)
        let url = directory.appendingPathComponent("\(name.isEmpty ? "Präsentation" : name).\(pptx ? "pptx" : "pdf")")
        do {
            try data.write(to: url, options: .atomic)
            exported = ExportedFile(url: url)
        } catch {
            errorMessage = "Export fehlgeschlagen: \(error.localizedDescription)"
        }
    }

    private func insertPicture(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.88),
              let name = try? store.saveMedia(data, fileExtension: "jpg")
        else {
            errorMessage = "Das Bild konnte nicht gespeichert werden."
            return
        }
        let frame = SlideGeometry.fit(width: image.size.width, height: image.size.height, into: (240, 110, 480, 320))
        model.addElement(SlideElement(kind: .image, x: frame.x, y: frame.y, width: frame.width, height: frame.height, image: name))
    }

    // Slide list

    private var slideList: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(Array(model.presentation.slides.enumerated()), id: \.element.id) { index, slide in
                        let isSelected = index == model.slideIndex
                        HStack(alignment: .top, spacing: 6) {
                            Text("\(index + 1)")
                                .font(.work(11))
                                .foregroundStyle(isSelected ? Quill.ink : Quill.faint)
                                .frame(width: 16, alignment: .leading)
                            SlideCanvas(slide: slide, theme: model.presentation.theme, images: images)
                                .clipShape(RoundedRectangle(cornerRadius: 4))
                                .overlay(RoundedRectangle(cornerRadius: 4).stroke(isSelected ? Quill.accent : Quill.line2, lineWidth: isSelected ? 2 : 1))
                                .onTapGesture { model.selectSlide(index) }
                                .contextMenu {
                                    Button("Duplizieren") { model.duplicateSlide(index) }
                                    Button("Nach oben") { model.moveSlide(index, by: -1) }
                                    Button("Nach unten") { model.moveSlide(index, by: 1) }
                                    Button("Löschen", role: .destructive) { model.deleteSlide(index) }
                                }
                        }
                    }
                }
                .padding(14)
            }
            .scrollIndicators(.hidden)
            Menu {
                ForEach(SlideLayout.allCases, id: \.self) { layout in
                    Button(layout.label) { model.addSlide(layout) }
                }
            } label: { menuLabel("+ Folie").frame(maxWidth: .infinity) }
            .padding(14)
        }
        .background(Quill.bg)
    }

    // Toolbars

    private var insertBar: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Button("Text") {
                    model.addElement(SlideLayouts.text("Text", 330, 230, 300, 60, 28), edit: true)
                }
                .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                Menu {
                    Button("Rechteck") { addShape(.rect) }
                    Button("Abgerundet") { addShape(.rounded) }
                    Button("Oval") { addShape(.ellipse) }
                    Button("Linie") { addShape(.line) }
                    Button("Pfeil") { addShape(.arrow) }
                } label: { menuLabel("Form") }
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Text("Foto")
                        .font(.work(13.5, .medium))
                        .foregroundStyle(Quill.ink)
                        .padding(.horizontal, 14)
                        .frame(height: 34)
                        .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                }
                Button("Seite aus Material") { isPickingPage = true }
                    .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                Rectangle().fill(Quill.line2).frame(width: 1, height: 24)
                Menu {
                    ForEach(SlideTheme.all) { theme in
                        Button(theme.name + (theme.id == model.presentation.themeId ? "  ✓" : "")) { model.setTheme(theme.id) }
                    }
                } label: { menuLabel("Design") }
                Rectangle().fill(Quill.line2).frame(width: 1, height: 24)
                Button("Rückgängig") { model.undo() }
                    .buttonStyle(QuillOutlineButtonStyle())
                    .disabled(!model.canUndo)
                Button("Wiederholen") { model.redo() }
                    .buttonStyle(QuillOutlineButtonStyle())
                    .disabled(!model.canRedo)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .scrollIndicators(.hidden)
        .background(Quill.bg)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private func addShape(_ type: ShapeType) {
        let line = type == .line || type == .arrow
        model.addElement(SlideElement(
            kind: .shape, x: 380, y: line ? 260 : 200, width: 200, height: line ? 20 : 140,
            shape: type, fill: line ? "text" : "accent", strokeWidth: line ? 4 : 0
        ))
    }

    @ViewBuilder
    private var inspector: some View {
        if let element = model.selected {
            let theme = model.presentation.theme
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    switch element.kind {
                    case .text:
                        chip("A−") { model.updateElement(element.id) { var e = $0; e.fontSize = max(8, e.fontSize - 2); return e } }
                        Text("\(Int(element.fontSize.rounded())) pt").font(.work(13)).foregroundStyle(Quill.muted).frame(width: 44)
                        chip("A+") { model.updateElement(element.id) { var e = $0; e.fontSize = min(160, e.fontSize + 2); return e } }
                        chip("B", selected: element.bold) { model.updateElement(element.id) { var e = $0; e.bold.toggle(); return e } }
                        chip("I", selected: element.italic) { model.updateElement(element.id) { var e = $0; e.italic.toggle(); return e } }
                        chip("•  Liste", selected: element.bullets) { model.updateElement(element.id) { var e = $0; e.bullets.toggle(); return e } }
                        chip(element.align == .left ? "Links" : (element.align == .center ? "Mitte" : "Rechts")) {
                            model.updateElement(element.id) { var e = $0
                                e.align = e.align == .left ? .center : (e.align == .center ? .right : .left)
                                return e
                            }
                        }
                        ColorChip(label: "Farbe", current: element.textColor, theme: theme, allowNone: false) { color in
                            model.updateElement(element.id) { var e = $0; e.textColor = color; return e }
                        }
                        chip("Bearbeiten") { model.startEditing(element.id) }
                    case .shape:
                        ColorChip(label: element.isLine ? "Farbe" : "Füllung", current: element.fill, theme: theme, allowNone: !element.isLine) { color in
                            model.updateElement(element.id) { var e = $0; e.fill = color; return e }
                        }
                        if element.isLine {
                            chip("Dünner") { model.updateElement(element.id) { var e = $0; e.strokeWidth = max(1, max(3, e.strokeWidth) - 1); return e } }
                            chip("Dicker") { model.updateElement(element.id) { var e = $0; e.strokeWidth = min(24, max(3, e.strokeWidth) + 1); return e } }
                        } else {
                            ColorChip(label: "Rand", current: element.stroke, theme: theme, allowNone: true) { color in
                                model.updateElement(element.id) { var e = $0
                                    e.stroke = color
                                    e.strokeWidth = color == "none" ? 0 : max(2, e.strokeWidth)
                                    return e
                                }
                            }
                        }
                    case .image:
                        Text("Bild").font(.work(13)).foregroundStyle(Quill.muted)
                    }
                    Rectangle().fill(Quill.line2).frame(width: 1, height: 24)
                    chip("Nach vorn") { model.reorderSelected(forward: true) }
                    chip("Nach hinten") { model.reorderSelected(forward: false) }
                    chip("Drehung 0°") { model.updateElement(element.id) { var e = $0; e.rotation = 0; return e } }
                    chip("Duplizieren") { model.duplicateSelected() }
                    chip("Löschen", color: Quill.warn) { model.deleteSelected() }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .scrollIndicators(.hidden)
            .background(Quill.bg)
            .overlay(alignment: .top) { QuillDivider(color: Quill.lineSoft) }
        }
    }

    private func chip(_ label: String, selected: Bool = false, color: Color = Quill.ink, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.work(13, .medium))
                .foregroundStyle(selected ? Quill.bg : color)
                .padding(.horizontal, 12)
                .frame(height: 32)
                .background(selected ? Quill.ink : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(selected ? Color.clear : Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var notesBar: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                PixelCaption(text: "Sprechernotizen", size: 9)
                TextField("Was du zu dieser Folie sagst …", text: Binding(get: { model.slide.notes }, set: { model.setNotes($0) }), axis: .vertical)
                    .font(.work(14))
                    .foregroundStyle(Quill.ink2)
                    .lineLimit(2...5)
            }
            Menu {
                ForEach(PresentationPrompt.Rewrite.allCases, id: \.self) { rewrite in
                    Button(rewrite.label) {
                        let slide = model.slide
                        runAI(rewrite.label) { assistant in model.replaceSlide(try await assistant.rewrite(slide, rewrite)) }
                    }
                }
                Button("Neu gestalten") {
                    let slide = model.slide
                    runAI("Neu gestalten") { assistant in model.replaceSlide(try await assistant.redesign(slide)) }
                }
            } label: { menuLabel("Folie mit KI") }
            .disabled(busy != nil)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Quill.bg)
        .overlay(alignment: .top) { QuillDivider(color: Quill.lineSoft) }
    }
}

/// A color button that opens a swatch grid.
private struct ColorChip: View {
    let label: String
    let current: String
    let theme: SlideTheme
    let allowNone: Bool
    let onPick: (String) -> Void
    @State private var isOpen = false

    var body: some View {
        Button {
            isOpen = true
        } label: {
            HStack(spacing: 8) {
                swatch(current, size: 14)
                Text(label).font(.work(13, .medium)).foregroundStyle(Quill.ink)
            }
            .padding(.horizontal, 12)
            .frame(height: 32)
            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .popover(isPresented: $isOpen) {
            HStack(spacing: 8) {
                ForEach((allowNone ? ["none"] : []) + swatchColors, id: \.self) { token in
                    Button {
                        isOpen = false
                        onPick(token)
                    } label: {
                        swatch(token, size: 26)
                            .padding(3)
                            .overlay(Circle().stroke(token == current ? Quill.accent : Color.clear, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .presentationCompactAdaptation(.popover)
        }
    }

    @ViewBuilder
    private func swatch(_ token: String, size: CGFloat) -> some View {
        if let rgb = theme.color(token) {
            Circle().fill(Color(SlideDrawing.uiColor(rgb))).frame(width: size, height: size)
                .overlay(Circle().stroke(Quill.line2, lineWidth: 1))
        } else {
            ZStack {
                Circle().stroke(Quill.line3, lineWidth: 1)
                Rectangle().fill(Quill.warn).frame(width: 1.5, height: size * 0.8).rotationEffect(.degrees(45))
            }
            .frame(width: size, height: size)
        }
    }
}

/// The slide with selection handles, snap guides and in-place text editing.
private struct EditorCanvasView: View {
    @ObservedObject var model: PresentationEditorModel
    let images: [String: UIImage]
    @State private var drag: EditorDrag?
    @State private var moved = false

    var body: some View {
        GeometryReader { geometry in
            let width: Double = min(Double(geometry.size.width), Double(geometry.size.height) * 16 / 9)
            let scale: Double = width / SlideSize.width
            let theme = model.presentation.theme
            ZStack(alignment: .topLeading) {
                SlideCanvas(slide: model.slide, theme: theme, images: images, skipping: model.editingID)
                Canvas { context, _ in
                    drawOverlay(in: &context, scale: scale)
                }
                .allowsHitTesting(false)
                if let editing = model.editing {
                    TextEditOverlay(model: model, element: editing, scale: scale, theme: theme)
                        .id(editing.id)
                }
            }
            .frame(width: width, height: width * 9 / 16)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in changed(value, scale: scale) }
                    .onEnded { _ in ended() }
            )
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
            .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
        }
        .padding(24)
    }

    private func changed(_ value: DragGesture.Value, scale: Double) {
        let px = Double(value.startLocation.x) / scale
        let py = Double(value.startLocation.y) / scale
        if drag == nil {
            model.finishEditing()
            let started = begin(px, py, scale: scale)
            drag = started
            moved = false
            if case .idle = started { return }
            model.beginGesture()
        }
        guard let current = drag else { return }
        if !moved, hypot(Double(value.translation.width), Double(value.translation.height)) < 4 { return }
        moved = true
        let x = Double(value.location.x) / scale
        let y = Double(value.location.y) / scale
        switch current {
        case .idle:
            return
        case let .move(base, _):
            var candidate = base
            candidate.x = base.x + x - px
            candidate.y = base.y + y - py
            let others = model.slide.elements.filter { $0.id != base.id && $0.rotation == 0 }
            let snap = SlideGeometry.snap(candidate, others: others, threshold: 7 / scale)
            model.verticalGuides = snap.verticalGuides
            model.horizontalGuides = snap.horizontalGuides
            candidate.x += snap.dx
            candidate.y += snap.dy
            model.updateElement(base.id, record: false) { _ in candidate }
        case let .resize(base, corner):
            model.updateElement(base.id, record: false) { _ in
                SlideGeometry.resize(base, corner: corner, to: x, y, keepAspect: base.kind == .image)
            }
        case let .lineEnd(base, start):
            model.updateElement(base.id, record: false) { _ in SlideGeometry.moveLineEnd(base, start: start, to: x, y) }
        case let .rotate(base):
            model.updateElement(base.id, record: false) { element in
                var rotated = element
                rotated.rotation = SlideGeometry.rotation(base, towards: x, y)
                return rotated
            }
        }
    }

    private func begin(_ px: Double, _ py: Double, scale: Double) -> EditorDrag {
        let handle = 22 / scale
        let rotateOffset = 30 / scale
        if let selected = model.selected {
            if selected.isLine {
                let start = selected.toSlide(0, selected.height / 2)
                let end = selected.toSlide(selected.width, selected.height / 2)
                if hypot(px - start.0, py - start.1) < handle { return .lineEnd(selected, start: true) }
                if hypot(px - end.0, py - end.1) < handle { return .lineEnd(selected, start: false) }
            } else {
                let knob = selected.toSlide(selected.width / 2, -rotateOffset)
                if hypot(px - knob.0, py - knob.1) < handle { return .rotate(selected) }
                for corner in SlideGeometry.Corner.allCases {
                    let point = SlideGeometry.corner(selected, corner)
                    if hypot(px - point.0, py - point.1) < handle { return .resize(selected, corner) }
                }
            }
        }
        if let hit = model.slide.elements.last(where: { $0.contains(px, py, slop: 4 / scale) }) {
            let tappedSelected = hit.id == model.selectedID
            model.selectedID = hit.id
            return .move(hit, tappedSelected: tappedSelected)
        }
        model.selectedID = nil
        return .idle
    }

    private func ended() {
        defer {
            drag = nil
            moved = false
        }
        guard let current = drag else { return }
        if case .idle = current { return }
        model.verticalGuides = []
        model.horizontalGuides = []
        model.endGesture()
        if !moved, case let .move(base, tappedSelected) = current, tappedSelected, base.kind == .text {
            model.startEditing(base.id)
        }
    }

    private func drawOverlay(in context: inout GraphicsContext, scale: Double) {
        let accent = Quill.accent
        for x in model.verticalGuides {
            var path = Path()
            path.move(to: CGPoint(x: x * scale, y: 0))
            path.addLine(to: CGPoint(x: x * scale, y: SlideSize.height * scale))
            context.stroke(path, with: .color(accent), style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
        }
        for y in model.horizontalGuides {
            var path = Path()
            path.move(to: CGPoint(x: 0, y: y * scale))
            path.addLine(to: CGPoint(x: SlideSize.width * scale, y: y * scale))
            context.stroke(path, with: .color(accent), style: StrokeStyle(lineWidth: 1, dash: [6, 4]))
        }
        guard let element = model.selected, model.editingID == nil else { return }
        func point(_ lx: Double, _ ly: Double) -> CGPoint {
            let slide = element.toSlide(lx, ly)
            return CGPoint(x: slide.0 * scale, y: slide.1 * scale)
        }
        var knobs: [CGPoint] = []
        if element.isLine {
            knobs = [point(0, element.height / 2), point(element.width, element.height / 2)]
        }
        if !element.isLine {
            let corners = SlideGeometry.Corner.allCases.map { point($0.fx * element.width, $0.fy * element.height) }
            var outline = Path()
            outline.addLines(corners)
            outline.closeSubpath()
            context.stroke(outline, with: .color(accent), lineWidth: 1.5)
            let top = point(element.width / 2, 0)
            let handle = point(element.width / 2, -30 / scale)
            var stem = Path()
            stem.move(to: top)
            stem.addLine(to: handle)
            context.stroke(stem, with: .color(accent), lineWidth: 1.5)
            context.fill(Path(ellipseIn: CGRect(x: handle.x - 6, y: handle.y - 6, width: 12, height: 12)), with: .color(accent))
            knobs = corners
        }
        for center in knobs {
            let rect = CGRect(x: center.x - 6, y: center.y - 6, width: 12, height: 12)
            context.fill(Path(ellipseIn: rect), with: .color(.white))
            context.stroke(Path(ellipseIn: rect), with: .color(accent), lineWidth: 1.5)
        }
    }
}

private struct TextEditOverlay: View {
    @ObservedObject var model: PresentationEditorModel
    let element: SlideElement
    let scale: Double
    let theme: SlideTheme
    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        let font = SlideDrawing.font(element).withSize(element.fontSize * scale)
        TextField("", text: $text, axis: .vertical)
            .font(Font(font as CTFont))
            .foregroundStyle(Color(SlideDrawing.uiColor(theme.color(element.textColor) ?? theme.text)))
            .multilineTextAlignment(element.align == .left ? .leading : (element.align == .center ? .center : .trailing))
            .focused($isFocused)
            .frame(width: element.width * scale, height: max(element.height, 40) * scale, alignment: .topLeading)
            .background(Color(SlideDrawing.uiColor(theme.accent)).opacity(0.08))
            .rotationEffect(.degrees(element.rotation))
            .position(x: element.centerX * scale, y: (element.y + max(element.height, 40) / 2) * scale)
            .onAppear {
                text = element.text
                isFocused = true
            }
            .onChange(of: text) { _, value in
                model.updateElement(element.id, record: false) { current in
                    var updated = current
                    updated.text = value
                    return updated
                }
            }
    }
}

/// Picks a page of a material from the library to put on the slide as a picture.
private struct MaterialPagePicker: View {
    let onPick: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \StudyMaterial.createdAt) private var materials: [StudyMaterial]
    @State private var material: StudyMaterial?
    @State private var document: PDFDocument?
    @State private var page = 1

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let material, let document {
                PixelCaption(text: material.title).padding(.bottom, 10)
                if let preview = document.page(at: page - 1)?.thumbnail(of: CGSize(width: 700, height: 700), for: .cropBox) {
                    Image(uiImage: preview)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: 380)
                        .padding(10)
                        .background(Quill.canvas, in: RoundedRectangle(cornerRadius: 10))
                }
                HStack {
                    Text("Seite \(page) von \(document.pageCount)").font(.work(15)).foregroundStyle(Quill.ink)
                    Spacer()
                    QuillStepper(onMinus: { page = max(1, page - 1) }, onPlus: { page = min(document.pageCount, page + 1) })
                }
                .padding(.top, 14)
                HStack(spacing: 14) {
                    Spacer()
                    Button("Zurück") {
                        self.material = nil
                        self.document = nil
                    }
                    .font(.work(15))
                    .foregroundStyle(Quill.muted)
                    .buttonStyle(.plain)
                    Button("Einfügen") {
                        if let image = document.page(at: page - 1)?.thumbnail(of: CGSize(width: 1600, height: 1600), for: .cropBox) {
                            onPick(image)
                        }
                    }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 38, fontSize: 14.5))
                }
                .padding(.top, 18)
            } else {
                PixelCaption(text: "Material wählen").padding(.bottom, 10)
                if materials.isEmpty {
                    Text("Die Bibliothek ist noch leer.").font(.work(15)).foregroundStyle(Quill.faint)
                }
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(materials) { item in
                            Button {
                                material = item
                                document = PDFDocument(url: item.fileURL)
                                page = 1
                            } label: {
                                Text(item.title)
                                    .font(.work(15.5))
                                    .foregroundStyle(Quill.ink)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 13)
                                    .overlay(alignment: .bottom) { QuillDivider() }
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
        }
        .padding(24)
        .presentationDetents([.large])
        .presentationBackground(Quill.bg)
    }
}
