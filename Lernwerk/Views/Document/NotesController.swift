import PDFKit
import PencilKit
import UIKit

/// Runs the document canvas: PDFKit shows the pages, each page gets an overlay with its texts, pictures, stickers
/// and a PencilKit canvas. Ink and notes are saved shortly after every change.
final class NotesController: NSObject, PDFPageOverlayViewProvider, PKCanvasViewDelegate {
    let container = NotesContainerView()
    let document: PDFDocument
    let fileName: String
    private(set) var tool: NoteTool = .read
    private(set) var settings = InkSettings()
    private(set) var notes: DocumentNotes
    private var drawings: [Int: PKDrawing]
    private var overlays: [Int: PageOverlayView] = [:]
    private var strokeCounts: [Int: Int] = [:]
    private var pendingSave: DispatchWorkItem?
    private var isReplacingDrawing = false
    private var changeSnapshot: [PageAnnotation]?
    private weak var editingView: AnnotationView?
    private var newTextID: String?

    private(set) var zoomActive = false
    private var zoomTarget: (page: Int, rect: CGRect)?
    private var isClearingZoom = false

    private(set) var instrument: InstrumentKind?
    private var instrumentPage = 0
    private var instrumentPose: InstrumentPose?

    var onPageChange: ((Int) -> Void)?
    var onUndoChange: ((Bool, Bool) -> Void)?
    var onMark: ((MarkedRegion) -> Void)?
    var onNotesChange: ((DocumentNotes) -> Void)?
    var onEditingChange: ((Bool) -> Void)?
    var onZoomClosed: (() -> Void)?

    init(document: PDFDocument, fileName: String, startPage: Int) {
        self.document = document
        self.fileName = fileName
        drawings = MaterialStore.loadDrawings(for: fileName)
        notes = MaterialStore.loadNotes(for: fileName)
        super.init()
        // The overlay provider has to be set before the document is assigned.
        container.pdfView.pageOverlayViewProvider = self
        container.pdfView.document = document
        container.markingView.onMark = { [weak self] rect in self?.handleMark(rect) }
        container.zoomPanel.canvas.delegate = self
        container.zoomPanel.onMove = { [weak self] dx, dy in self?.moveZoomTarget(dx: dx, dy: dy) }
        container.zoomPanel.onNewLine = { [weak self] in self?.zoomNewLine() }
        container.zoomPanel.onClose = { [weak self] in self?.onZoomClosed?() }
        NotificationCenter.default.addObserver(self, selector: #selector(pageChanged), name: .PDFViewPageChanged, object: container.pdfView)
        for name in [Notification.Name.NSUndoManagerDidCloseUndoGroup, .NSUndoManagerDidUndoChange, .NSUndoManagerDidRedoChange] {
            NotificationCenter.default.addObserver(self, selector: #selector(undoChanged), name: name, object: nil)
        }
        if let page = document.page(at: startPage) {
            DispatchQueue.main.async { [weak self] in self?.container.pdfView.go(to: page) }
        }
        apply(tool: .read, settings: settings)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    /// The undo manager PencilKit uses, so ink and notes share one history.
    private var undoManager: UndoManager? {
        overlays.values.first?.canvas.undoManager ?? container.undoManager
    }

    var canUndo: Bool { undoManager?.canUndo ?? false }
    var canRedo: Bool { undoManager?.canRedo ?? false }

    var currentPage: Int {
        container.pdfView.currentPage.map { document.index(for: $0) } ?? 0
    }

    /// Every page's ink as it is now, including what is still on a visible canvas.
    var currentDrawings: [Int: PKDrawing] {
        var result = drawings
        for (index, overlay) in overlays {
            result[index] = overlay.canvas.drawing
        }
        return result
    }

    // Tools

    func apply(tool: NoteTool, settings: InkSettings) {
        let toolChanged = tool != self.tool
        self.tool = tool
        self.settings = settings
        if toolChanged, !tool.editsAnnotations { container.endEditing(true) }
        let markup = tool.usesCanvas
        if container.pdfView.isInMarkupMode != markup { container.pdfView.isInMarkupMode = markup }
        if tool != .mark { container.markingView.clearSelection() }
        container.markingView.isHidden = tool != .mark
        container.laserView.isUserInteractionEnabled = tool == .laser
        overlays.values.forEach(configure)
        applyTextSettings()
        updateZoomPanel()
    }

    private func configure(_ overlay: PageOverlayView) {
        let showsInstrument = instrument != nil && overlay.pageIndex == instrumentPage
        overlay.isUserInteractionEnabled = tool.usesCanvas || tool.editsAnnotations || showsInstrument
        overlay.canvas.isUserInteractionEnabled = tool.usesCanvas
        if let pkTool = settings.pkTool(for: tool) { overlay.canvas.tool = pkTool }
        overlay.tap.isEnabled = tool == .typing || tool == .textBox
        overlay.updateHandles()
        if showsInstrument, var pose = instrumentPose {
            if overlay.bounds.width > 0 { pose.unitsPerCm = unitsPerCm(on: overlay.pageIndex, width: overlay.bounds.width) }
            instrumentPose = pose
            overlay.instrumentLayer.show(instrument, pose: pose)
        } else {
            overlay.instrumentLayer.show(nil, pose: overlay.instrumentLayer.pose)
        }
    }

    // Instruments

    /// Lays the instrument on the page in view, in the middle of what is visible; nil takes it away.
    func showInstrument(_ kind: InstrumentKind?) {
        instrument = kind
        if kind != nil {
            let page = currentPage
            let size = pageCanvasSize(page)
            var center = CGPoint(x: size.width / 2, y: size.height / 2)
            if let overlay = overlays[page] {
                let visible = overlay.convert(CGPoint(x: container.pdfView.bounds.midX, y: container.pdfView.bounds.midY), from: container.pdfView)
                center.y = min(max(visible.y, 0), size.height)
            }
            var pose = instrumentPose ?? InstrumentPose(center: center, unitsPerCm: Instruments.pointsPerCm)
            pose.center = center
            pose.unitsPerCm = unitsPerCm(on: page, width: size.width)
            if kind == .compass { pose.angle = 0 }
            instrumentPose = pose
            instrumentPage = page
        }
        overlays.values.forEach(configure)
    }

    func instrumentMoved(_ pose: InstrumentPose) {
        instrumentPose = pose
    }

    /// The ink an instrument draws with: the pen or the highlighter, as set; nil in other tools, where the
    /// instrument only moves.
    var instrumentInk: (ink: PKInk, width: CGFloat)? {
        switch tool {
        case .pen, .shapes:
            return (PKInk(settings.penKind.inkType, color: QuillUIColor.hex(settings.penColor)), settings.penWidth)
        case .highlighter:
            return (PKInk(.marker, color: QuillUIColor.hex(settings.highlighterColor)), settings.highlighterWidth)
        default:
            return nil
        }
    }

    /// Adds a line or arc drawn with an instrument to a page, as one stroke that can be undone.
    func addInstrumentStroke(_ points: [CGPoint], page: Int) {
        guard let pen = instrumentInk, points.count > 1 else { return }
        let width = pen.width
        let controlPoints = points.enumerated().map { index, point in
            PKStrokePoint(
                location: point,
                timeOffset: TimeInterval(index) * 0.004,
                size: CGSize(width: width, height: width),
                opacity: 1,
                force: 1,
                azimuth: 0,
                altitude: .pi / 2
            )
        }
        var drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        drawing.strokes.append(PKStroke(ink: pen.ink, path: PKStrokePath(controlPoints: controlPoints, creationDate: Date())))
        setDrawing(drawing, page: page)
    }

    /// Zooms so a centimetre of the page is a centimetre on the screen, for measuring with a real ruler too.
    func setTrueScale() {
        let pdfView = container.pdfView
        let page = pdfView.currentPage
        let screenScale = container.window?.screen.nativeScale ?? UIScreen.main.nativeScale
        pdfView.autoScales = false
        pdfView.scaleFactor = Instruments.trueScaleFactor(ppi: DeviceScreen.ppi, screenScale: screenScale)
        if let page { pdfView.go(to: page) }
    }

    func fitWidth() {
        container.pdfView.autoScales = true
    }

    private func pageCanvasSize(_ page: Int) -> CGSize {
        if let overlay = overlays[page], overlay.bounds.width > 0 { return overlay.bounds.size }
        return notes.canvasSizes[page] ?? document.page(at: page)?.bounds(for: .cropBox).size ?? CGSize(width: 595, height: 842)
    }

    private func unitsPerCm(on page: Int, width: CGFloat) -> Double {
        let pageWidth = document.page(at: page)?.bounds(for: .cropBox).width ?? 595
        return Instruments.unitsPerCm(canvasWidth: Double(width), pageWidth: Double(pageWidth))
    }

    // Pages

    func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
        guard let index = view.document?.index(for: page) else { return nil }
        if let existing = overlays[index] { return existing }
        let overlay = PageOverlayView(pageIndex: index, controller: self)
        overlay.canvas.drawing = drawings[index] ?? PKDrawing()
        overlay.canvas.delegate = self
        strokeCounts[index] = overlay.canvas.drawing.strokes.count
        overlay.reload(notes.annotations(on: index), editingID: nil)
        overlays[index] = overlay
        configure(overlay)
        return overlay
    }

    func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
        guard let overlay = overlayView as? PageOverlayView else { return }
        drawings[overlay.pageIndex] = overlay.canvas.drawing
        overlays[overlay.pageIndex] = nil
    }

    /// Remembers the canvas size of each page: it maps ink and notes onto the PDF page for export.
    func overlayDidLayout(_ overlay: PageOverlayView) {
        let size = overlay.bounds.size
        guard size.width > 0, notes.canvasSizes[overlay.pageIndex] != size else { return }
        notes.canvasSizes[overlay.pageIndex] = size
        scheduleSave()
        if instrument != nil, overlay.pageIndex == instrumentPage { configure(overlay) }
        if zoomTarget?.page == overlay.pageIndex { updateZoomBackground() }
    }

    func go(to page: Int) {
        guard let target = document.page(at: page) else { return }
        container.pdfView.go(to: target)
    }

    func go(to selection: PDFSelection) {
        container.pdfView.go(to: selection)
        container.pdfView.highlightedSelections = [selection]
    }

    @objc private func pageChanged() {
        onPageChange?(currentPage)
    }

    // Ink

    func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
        if canvasView === container.zoomPanel.canvas {
            transferZoomStrokes()
            return
        }
        guard !isReplacingDrawing, let overlay = canvasView.superview as? PageOverlayView else { return }
        let index = overlay.pageIndex
        let count = canvasView.drawing.strokes.count
        if tool == .shapes, count > (strokeCounts[index] ?? 0) {
            recognizeLastStroke(on: canvasView)
        }
        strokeCounts[index] = canvasView.drawing.strokes.count
        drawings[index] = canvasView.drawing
        if zoomTarget?.page == index { updateZoomBackground() }
        scheduleSave()
        notifyUndo()
    }

    /// The shape tool replaces a freehand stroke with the clean line, polygon or ellipse it resembles.
    private func recognizeLastStroke(on canvas: PKCanvasView) {
        guard let stroke = canvas.drawing.strokes.last, let template = stroke.path.first else { return }
        let points = stroke.path.map { $0.location.applying(stroke.transform) }
        guard let shape = ShapeRecognizer.recognize(points) else { return }
        let outline = shape.outline()
        let controlPoints = outline.enumerated().map { index, point in
            PKStrokePoint(
                location: point,
                timeOffset: TimeInterval(index) * 0.005,
                size: template.size,
                opacity: template.opacity,
                force: template.force,
                azimuth: template.azimuth,
                altitude: template.altitude
            )
        }
        let clean = PKStroke(ink: stroke.ink, path: PKStrokePath(controlPoints: controlPoints, creationDate: Date()))
        var strokes = canvas.drawing.strokes
        strokes[strokes.count - 1] = clean
        isReplacingDrawing = true
        canvas.drawing = PKDrawing(strokes: strokes)
        isReplacingDrawing = false
    }

    /// Sets a page's ink with an undo step, for changes the canvas does not record itself.
    private func setDrawing(_ drawing: PKDrawing, page: Int) {
        let previous = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        undoManager?.registerUndo(withTarget: self) { target in target.setDrawing(previous, page: page) }
        drawings[page] = drawing
        if let canvas = overlays[page]?.canvas {
            isReplacingDrawing = true
            canvas.drawing = drawing
            isReplacingDrawing = false
            strokeCounts[page] = drawing.strokes.count
        }
        if zoomTarget?.page == page { updateZoomBackground() }
        scheduleSave()
        notifyUndo()
    }

    // History

    func undo() {
        container.endEditing(true)
        undoManager?.undo()
        notifyUndo()
    }

    func redo() {
        container.endEditing(true)
        undoManager?.redo()
        notifyUndo()
    }

    @objc private func undoChanged() {
        notifyUndo()
    }

    private func notifyUndo() {
        onUndoChange?(canUndo, canRedo)
    }

    // Texts, pictures and stickers

    func tapOnPage(_ overlay: PageOverlayView, at point: CGPoint) {
        guard tool == .typing || tool == .textBox else { return }
        if editingView != nil {
            container.endEditing(true)
            return
        }
        let style = settings.textStyle
        let boxed = tool == .textBox
        let width = boxed
            ? min(260, overlay.bounds.width - point.x - 12)
            : overlay.bounds.width - point.x - 24
        guard width > 40 else { return }
        let annotation = PageAnnotation(
            page: overlay.pageIndex,
            kind: .text,
            x: point.x - (boxed ? 8 : 0),
            y: point.y - style.size * 0.9,
            width: width,
            height: style.size * 1.6 + 8,
            style: style,
            color: settings.textColor,
            align: settings.textAlign,
            boxed: boxed
        )
        changeSnapshot = notes.annotations
        newTextID = annotation.id
        notes.annotations.append(annotation)
        overlay.reload(notes.annotations(on: overlay.pageIndex), editingID: nil)
        overlay.annotationViews[annotation.id]?.beginEditing()
    }

    func didBeginEditing(_ view: AnnotationView) {
        editingView = view
        if newTextID != view.annotation.id { changeSnapshot = notes.annotations }
        onEditingChange?(true)
    }

    func didEndEditing(_ view: AnnotationView, text: String) {
        editingView = nil
        onEditingChange?(false)
        let id = view.annotation.id
        let previous = changeSnapshot ?? notes.annotations
        changeSnapshot = nil
        let isNew = newTextID == id
        newTextID = nil
        var updated = notes.annotations
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            updated.removeAll { $0.id == id }
            // An empty new text leaves no trace in the history.
            if isNew {
                notes.annotations = updated
                refreshAnnotations()
                scheduleSave()
                return
            }
        } else if let index = updated.firstIndex(where: { $0.id == id }) {
            updated[index].text = text
            updated[index].frame = view.frame
            updated[index].style = view.annotation.style
            updated[index].color = view.annotation.color
            updated[index].align = view.annotation.align
        }
        commitAnnotations(updated, previous: previous, name: "Text")
    }

    /// Style, color and alignment from the toolbar go to the text being edited.
    private func applyTextSettings() {
        guard let view = editingView, view.annotation.kind == .text else { return }
        var annotation = view.annotation
        annotation.style = settings.textStyle
        annotation.color = settings.textColor
        annotation.align = settings.textAlign
        annotation.frame = view.frame
        annotation.text = view.textView?.text ?? annotation.text
        view.update(annotation)
        view.fitText()
    }

    func beginAnnotationChange() {
        changeSnapshot = notes.annotations
    }

    func commitFrame(of id: String, frame: CGRect) {
        let previous = changeSnapshot ?? notes.annotations
        changeSnapshot = nil
        var updated = notes.annotations
        guard let index = updated.firstIndex(where: { $0.id == id }) else { return }
        updated[index].frame = frame
        commitAnnotations(updated, previous: previous, name: "Verschieben")
    }

    func deleteAnnotation(_ id: String) {
        commitAnnotations(notes.annotations.filter { $0.id != id }, previous: notes.annotations, name: "Löschen")
    }

    func duplicateAnnotation(_ id: String) {
        guard var copy = notes.annotations.first(where: { $0.id == id }) else { return }
        copy.id = UUID().uuidString
        copy.x += 20
        copy.y += 20
        commitAnnotations(notes.annotations + [copy], previous: notes.annotations, name: "Duplizieren")
    }

    func insertImage(_ image: UIImage) {
        guard let name = MaterialStore.saveNoteImage(image) else { return }
        let aspect = image.size.width / max(image.size.height, 1)
        insert(kind: .image, text: "", image: name, aspect: aspect, widthShare: 0.5)
    }

    func insertSticker(_ text: String) {
        let isLabel = Stickers.color(for: text) != nil
        insert(kind: .sticker, text: text, image: nil, aspect: isLabel ? 3.4 : 1, widthShare: isLabel ? 0.26 : 0.12)
    }

    /// Places a new annotation in the middle of what is visible of the current page.
    private func insert(kind: PageAnnotation.Kind, text: String, image: String?, aspect: CGFloat, widthShare: CGFloat) {
        let page = currentPage
        let size = overlays[page]?.bounds.size ?? notes.canvasSizes[page] ?? document.page(at: page)?.bounds(for: .cropBox).size ?? CGSize(width: 595, height: 842)
        var width = size.width * widthShare
        var height = width / max(aspect, 0.01)
        if height > size.height * 0.6 {
            height = size.height * 0.6
            width = height * aspect
        }
        var center = CGPoint(x: size.width / 2, y: size.height / 2)
        if let overlay = overlays[page] {
            let visible = overlay.convert(CGPoint(x: container.pdfView.bounds.midX, y: container.pdfView.bounds.midY), from: container.pdfView)
            center.y = min(max(visible.y, height / 2), size.height - height / 2)
        }
        var annotation = PageAnnotation(page: page, kind: kind, x: center.x - width / 2, y: center.y - height / 2, width: width, height: height, text: text)
        annotation.image = image
        commitAnnotations(notes.annotations + [annotation], previous: notes.annotations, name: "Einfügen")
    }

    private func commitAnnotations(_ updated: [PageAnnotation], previous: [PageAnnotation], name: String) {
        notes.annotations = updated
        undoManager?.registerUndo(withTarget: self) { target in
            target.commitAnnotations(previous, previous: updated, name: name)
        }
        undoManager?.setActionName(name)
        refreshAnnotations()
        scheduleSave()
        notifyUndo()
    }

    private func refreshAnnotations() {
        for (index, overlay) in overlays {
            overlay.reload(notes.annotations(on: index), editingID: editingView?.annotation.id)
        }
    }

    // Bookmarks

    func toggleBookmark(_ page: Int) {
        if notes.bookmarks.contains(page) { notes.bookmarks.remove(page) } else { notes.bookmarks.insert(page) }
        scheduleSave()
        onNotesChange?(notes)
    }

    // Tutor

    private func handleMark(_ rect: CGRect) {
        guard let region = container.region(for: rect) else { return }
        onMark?(region)
    }

    // Zoom window

    func setZoom(_ active: Bool) {
        zoomActive = active
        if active {
            placeZoomTarget()
        } else {
            zoomTarget = nil
            overlays.values.forEach { $0.showTarget(nil) }
        }
        updateZoomPanel()
    }

    private func updateZoomPanel() {
        let visible = zoomActive && tool.writesInZoom
        container.setZoomPanel(visible: visible)
        guard visible else { return }
        if let pkTool = settings.pkTool(for: tool) { container.zoomPanel.canvas.tool = pkTool }
        if zoomTarget == nil { placeZoomTarget() }
        updateZoomBackground()
    }

    /// The frame starts at the left margin, at the height of the middle of the screen.
    private func placeZoomTarget() {
        let page = currentPage
        guard let overlay = overlays[page], overlay.bounds.width > 0 else { return }
        let panel = container.zoomPanel.canvas.bounds.size
        let width = overlay.bounds.width * 0.32
        let height = width * max(panel.height, 1) / max(panel.width, 1)
        let visible = overlay.convert(CGPoint(x: container.pdfView.bounds.midX, y: container.pdfView.bounds.midY), from: container.pdfView)
        let y = min(max(0, visible.y - height / 2), overlay.bounds.height - height)
        setZoomTarget(page: page, rect: CGRect(x: min(40, overlay.bounds.width - width), y: y, width: width, height: height))
    }

    private func setZoomTarget(page: Int, rect: CGRect) {
        zoomTarget = (page, rect)
        for (index, overlay) in overlays {
            overlay.showTarget(index == page ? rect : nil)
        }
        updateZoomBackground()
    }

    private func moveZoomTarget(dx: CGFloat, dy: CGFloat) {
        guard let target = zoomTarget, let overlay = overlays[target.page] else {
            placeZoomTarget()
            return
        }
        var rect = target.rect.offsetBy(dx: dx * target.rect.width * 0.5, dy: dy * target.rect.height)
        rect.origin.x = min(max(0, rect.minX), overlay.bounds.width - rect.width)
        rect.origin.y = min(max(0, rect.minY), overlay.bounds.height - rect.height)
        setZoomTarget(page: target.page, rect: rect)
    }

    private func zoomNewLine() {
        guard let target = zoomTarget, let overlay = overlays[target.page] else { return }
        var rect = target.rect
        rect.origin.x = min(40, overlay.bounds.width - rect.width)
        rect.origin.y = min(rect.maxY, overlay.bounds.height - rect.height)
        setZoomTarget(page: target.page, rect: rect)
    }

    /// Moves what was written in the zoom window onto the page, scaled down into the frame.
    private func transferZoomStrokes() {
        let zoomCanvas = container.zoomPanel.canvas
        guard !isClearingZoom, let target = zoomTarget, zoomCanvas.bounds.width > 0 else { return }
        let strokes = zoomCanvas.drawing.strokes
        guard !strokes.isEmpty else { return }
        let scale = target.rect.width / zoomCanvas.bounds.width
        let transform = CGAffineTransform(scaleX: scale, y: scale)
            .concatenating(CGAffineTransform(translationX: target.rect.minX, y: target.rect.minY))
        var drawing = overlays[target.page]?.canvas.drawing ?? drawings[target.page] ?? PKDrawing()
        drawing.append(PKDrawing(strokes: strokes).transformed(using: transform))
        let writtenUpTo = PKDrawing(strokes: strokes).bounds.maxX
        isClearingZoom = true
        zoomCanvas.drawing = PKDrawing()
        isClearingZoom = false
        setDrawing(drawing, page: target.page)
        // Like a typewriter: near the right edge the frame moves on.
        if writtenUpTo > zoomCanvas.bounds.width * 0.78, let overlay = overlays[target.page] {
            if target.rect.maxX + target.rect.width * 0.5 > overlay.bounds.width {
                zoomNewLine()
            } else {
                moveZoomTarget(dx: 1, dy: 0)
            }
        }
    }

    /// The page region under the frame, enlarged, as the background of the zoom window.
    private func updateZoomBackground() {
        let panel = container.zoomPanel.canvas.bounds.size
        guard let target = zoomTarget, panel.width > 0,
              let overlay = overlays[target.page], overlay.bounds.width > 0,
              let page = document.page(at: target.page)
        else { return }
        let zoom = panel.width / target.rect.width
        let box = page.bounds(for: .cropBox)
        let canvasSize = overlay.bounds.size
        let drawing = overlay.canvas.drawing
        let image = UIGraphicsImageRenderer(size: panel).image { context in
            let cg = context.cgContext
            UIColor.white.setFill()
            cg.fill(CGRect(origin: .zero, size: panel))
            cg.scaleBy(x: zoom, y: zoom)
            cg.translateBy(x: -target.rect.minX, y: -target.rect.minY)
            cg.saveGState()
            cg.scaleBy(x: canvasSize.width / box.width, y: canvasSize.height / box.height)
            cg.translateBy(x: 0, y: box.height)
            cg.scaleBy(x: 1, y: -1)
            page.draw(with: .cropBox, to: cg)
            cg.restoreGState()
            UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
                drawing.image(from: target.rect, scale: zoom * 2).draw(in: target.rect)
            }
        }
        container.zoomPanel.background.image = image
    }

    // Saving

    private func scheduleSave() {
        pendingSave?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.saveNow() }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
    }

    func saveNow() {
        pendingSave?.cancel()
        container.endEditing(true)
        for (index, overlay) in overlays {
            drawings[index] = overlay.canvas.drawing
        }
        MaterialStore.saveDrawings(drawings, for: fileName)
        MaterialStore.saveNotes(notes, for: fileName)
    }
}
