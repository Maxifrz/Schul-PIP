import PDFKit
import PencilKit
import UIKit

/// A line that ends in a written "=": where it is, and the ink of it and the lines above as a picture.
struct MathLineRequest {
    var page: Int
    var equals: CGRect
    var line: CGRect
    var imageJPEG: Data
}

/// A region framed with the calculate tool, as the student sees it.
struct MathRegionRequest: Identifiable {
    let id = UUID()
    var page: Int
    var frame: CGRect
    var imageJPEG: Data
}

/// What the lasso has taken in on a page, and what is going on while it is dragged.
private struct LassoState {
    var page: Int
    var strokeIndices: [Int]
    var strokeCount: Int
    var annotationIDs: [String]
    var bounds: CGRect
    /// While dragging: the page's ink as it was, the strokes lifted off it, and where the annotations were.
    var original: PKDrawing?
    var lifted: [PKStroke] = []
    var startFrames: [String: CGRect] = [:]
}

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
    /// The text or table being typed in, kept when its page's view is recycled so typing can go on.
    private var editingAnnotationID: String?
    private var keyboardInset: CGFloat = 0
    private var lasso: LassoState?

    /// The most the page can be enlarged, in times the size at 100 %.
    static let maxZoom: CGFloat = 16
    private var pendingSharpen: DispatchWorkItem?

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
    /// A written "=" wants its line calculated.
    var onMathLine: ((MathLineRequest) -> Void)?
    /// A frame was drawn with the calculate tool.
    var onMathRegion: ((MathRegionRequest) -> Void)?
    private var pendingMathCheck: DispatchWorkItem?
    private var mathPreview: (page: Int, text: String, origin: CGPoint, size: CGFloat)?

    init(document: PDFDocument, fileName: String, startPage: Int) {
        self.document = document
        self.fileName = fileName
        drawings = MaterialStore.loadDrawings(for: fileName)
        notes = MaterialStore.loadNotes(for: fileName)
        super.init()
        // The overlay provider has to be set before the document is assigned.
        container.pdfView.pageOverlayViewProvider = self
        container.pdfView.document = document
        // Far more than PDFKit's default: small handwriting and fine print can be enlarged until they fill the screen.
        container.pdfView.maxScaleFactor = Self.maxZoom
        container.markingView.onMark = { [weak self] rect in self?.handleMark(rect) }
        container.zoomPanel.canvas.delegate = self
        container.zoomPanel.onMove = { [weak self] dx, dy in self?.moveZoomTarget(dx: dx, dy: dy) }
        container.zoomPanel.onNewLine = { [weak self] in self?.zoomNewLine() }
        container.zoomPanel.onClose = { [weak self] in self?.onZoomClosed?() }
        NotificationCenter.default.addObserver(self, selector: #selector(pageChanged), name: .PDFViewPageChanged, object: container.pdfView)
        NotificationCenter.default.addObserver(self, selector: #selector(zoomChanged), name: .PDFViewScaleChanged, object: container.pdfView)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardChanged(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardChanged(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
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
        let lassoModeChanged = settings.nativeLasso != self.settings.nativeLasso
        self.tool = tool
        self.settings = settings
        if toolChanged || lassoModeChanged { lassoClear() }
        if toolChanged, !tool.editsAnnotations { container.endEditing(true) }
        let markup = tool.usesCanvas
        if container.pdfView.isInMarkupMode != markup { container.pdfView.isInMarkupMode = markup }
        if !tool.marksRegion { container.markingView.clearSelection() }
        container.markingView.isHidden = !tool.marksRegion
        if toolChanged { hideMathPreview() }
        container.laserView.isUserInteractionEnabled = tool == .laser
        overlays.values.forEach(configure)
        applyTextSettings()
        updateZoomPanel()
    }

    private func configure(_ overlay: PageOverlayView) {
        let showsInstrument = instrument != nil && overlay.pageIndex == instrumentPage
        // The lasso that also takes texts and pictures works on its own layer; the pencil's lasso on the canvas.
        let ownLasso = tool == .lasso && !settings.nativeLasso
        overlay.isUserInteractionEnabled = tool.usesCanvas || tool.editsAnnotations || showsInstrument
        overlay.canvas.isUserInteractionEnabled = tool.usesCanvas && !ownLasso
        overlay.lassoLayer.isHidden = !ownLasso
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
        overlay.renderSharp(at: container.pdfView.scaleFactor)
        // The page's view was recycled while typing (the keyboard came up, the page scrolled): go on where it was.
        if let id = editingAnnotationID, overlay.annotationViews[id] != nil {
            DispatchQueue.main.async { [weak overlay] in overlay?.annotationViews[id]?.beginEditing() }
        }
        return overlay
    }

    func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
        guard let overlay = overlayView as? PageOverlayView else { return }
        drawings[overlay.pageIndex] = overlay.canvas.drawing
        // What was typed so far is not lost with the view.
        if let view = editingView, overlay.annotationViews[view.annotation.id] === view {
            keepTyped(in: view)
        }
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

    /// Ink and text are drawn again at the new size once the pinch has come to rest, so they stay sharp when enlarged
    /// instead of showing the pixels of the size they were first drawn at.
    @objc private func zoomChanged() {
        pendingSharpen?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            let zoom = self.container.pdfView.scaleFactor
            self.overlays.values.forEach { $0.renderSharp(at: zoom) }
        }
        pendingSharpen = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2, execute: work)
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
        // One new pen stroke: thinner than PencilKit's smallest width if the pen is set that thin.
        if tool == .pen, count == (strokeCounts[index] ?? 0) + 1, settings.penThinning < 0.999 {
            thinLastStroke(on: canvasView, by: settings.penThinning)
        }
        if count > (strokeCounts[index] ?? 0) {
            hideMathPreview()
            if tool == .pen, settings.mathPreview { watchForEquals(on: index, drawing: canvasView.drawing) }
        }
        strokeCounts[index] = canvasView.drawing.strokes.count
        drawings[index] = canvasView.drawing
        if zoomTarget?.page == index { updateZoomBackground() }
        scheduleSave()
        notifyUndo()
    }

    /// Scales the nib of the last stroke, which is how a pen set thinner than PencilKit allows gets its line.
    private func thinLastStroke(on canvas: PKCanvasView, by ratio: CGFloat) {
        guard let stroke = canvas.drawing.strokes.last else { return }
        let points = stroke.path.map { point in
            PKStrokePoint(
                location: point.location,
                timeOffset: point.timeOffset,
                size: CGSize(width: point.size.width * ratio, height: point.size.height * ratio),
                opacity: point.opacity,
                force: point.force,
                azimuth: point.azimuth,
                altitude: point.altitude
            )
        }
        let thin = PKStroke(
            ink: stroke.ink,
            path: PKStrokePath(controlPoints: points, creationDate: stroke.path.creationDate),
            transform: stroke.transform,
            mask: stroke.mask
        )
        var strokes = canvas.drawing.strokes
        strokes[strokes.count - 1] = thin
        isReplacingDrawing = true
        canvas.drawing = PKDrawing(strokes: strokes)
        isReplacingDrawing = false
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
        lassoClear()
        container.endEditing(true)
        undoManager?.undo()
        notifyUndo()
    }

    func redo() {
        lassoClear()
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
        beginText(at: point, on: overlay)
    }

    /// A new text where the page was tapped, or a text box in the textbox tool, with the keyboard up.
    private func beginText(at point: CGPoint, on overlay: PageOverlayView) {
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
        editingAnnotationID = annotation.id
        notes.annotations.append(annotation)
        overlay.reload(notes.annotations(on: overlay.pageIndex), editingID: nil)
        overlay.annotationViews[annotation.id]?.beginEditing()
    }

    /// A new text in the middle of what is visible: for when tapping the page is not at hand, as with a keyboard
    /// and no finger free.
    func newText() {
        container.endEditing(true)
        let page = currentPage
        guard let overlay = overlays[page], overlay.bounds.width > 0 else { return }
        let visible = overlay.convert(CGPoint(x: container.pdfView.bounds.midX, y: container.pdfView.bounds.midY), from: container.pdfView)
        let point = CGPoint(x: max(24, overlay.bounds.width * 0.1), y: min(max(visible.y, 40), max(40, overlay.bounds.height - 60)))
        beginText(at: point, on: overlay)
    }

    /// Heading, list or checkbox for the lines being typed.
    func format(_ block: NoteBlock) {
        // Without a text being typed, the button starts one.
        if editingView == nil { newText() }
        editingView?.applyBlock(block)
    }

    /// A table of three by three cells below the text being typed, or in the middle of what is visible.
    func insertTable(below view: AnnotationView? = nil) {
        var page = currentPage
        var origin: CGPoint?
        var width: CGFloat?
        if let view {
            page = view.annotation.page
            origin = CGPoint(x: view.frame.minX, y: view.frame.maxY + 10)
            width = view.frame.width
        }
        // Ends typing, which saves the text before the table is added.
        container.endEditing(true)
        let size = overlays[page]?.bounds.size ?? notes.canvasSizes[page] ?? document.page(at: page)?.bounds(for: .cropBox).size ?? CGSize(width: 595, height: 842)
        let tableWidth = min(max(width ?? 0, size.width * 0.6), size.width - 32)
        var position = origin ?? CGPoint(x: (size.width - tableWidth) / 2, y: size.height / 2)
        if origin == nil, let overlay = overlays[page] {
            let visible = overlay.convert(CGPoint(x: container.pdfView.bounds.midX, y: container.pdfView.bounds.midY), from: container.pdfView)
            position.y = min(max(visible.y - 60, 20), max(20, size.height - 140))
        }
        position.x = min(max(16, position.x), max(16, size.width - tableWidth - 16))
        var annotation = PageAnnotation(page: page, kind: .table, x: position.x, y: position.y, width: tableWidth, height: 0)
        annotation.cells = NoteTable.blank()
        annotation.color = settings.textColor
        annotation.height = NoteTableLayout.totalHeight(annotation.cells ?? [], width: tableWidth, header: true, look: NoteRichText.Look(annotation))
        commitAnnotations(notes.annotations + [annotation], previous: notes.annotations, name: "Tabelle")
        editingAnnotationID = annotation.id
        overlays[page]?.annotationViews[annotation.id]?.beginEditing()
    }

    func editTable(_ id: String, _ edit: NoteTable.Edit) {
        guard let index = notes.annotations.firstIndex(where: { $0.id == id }), let cells = notes.annotations[index].cells else { return }
        var updated = notes.annotations
        let changed = NoteTable.applying(edit, to: cells)
        updated[index].cells = changed
        updated[index].height = NoteTableLayout.totalHeight(changed, width: updated[index].width, header: updated[index].hasHeader, look: NoteRichText.Look(updated[index]))
        commitAnnotations(updated, previous: notes.annotations, name: "Tabelle")
    }

    func toggleTableHeader(_ id: String) {
        guard let index = notes.annotations.firstIndex(where: { $0.id == id }) else { return }
        var updated = notes.annotations
        updated[index].header = !updated[index].hasHeader
        updated[index].height = NoteTableLayout.totalHeight(updated[index].cells ?? [], width: updated[index].width, header: updated[index].hasHeader, look: NoteRichText.Look(updated[index]))
        commitAnnotations(updated, previous: notes.annotations, name: "Tabelle")
    }

    /// What was typed in the view is put in the notes without an undo step; the step follows when typing ends.
    private func keepTyped(in view: AnnotationView) {
        guard let index = notes.annotations.firstIndex(where: { $0.id == view.annotation.id }) else { return }
        if let text = view.currentText { notes.annotations[index].text = text }
        notes.annotations[index].frame = view.frame
    }

    func didBeginEditing(_ view: AnnotationView) {
        editingView = view
        editingAnnotationID = view.annotation.id
        revealEditing()
        if newTextID != view.annotation.id { changeSnapshot = notes.annotations }
        onEditingChange?(true)
    }

    func didEndEditing(_ view: AnnotationView, text: String) {
        // A view whose page was recycled while typing reports its end when it leaves the window; typing goes on in the
        // page's new view and the text was kept when the old one went.
        if view.window == nil, editingAnnotationID == view.annotation.id { return }
        editingView = nil
        editingAnnotationID = nil
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

    /// The table's cells and size when typing in it is over: one undo step.
    func didEndEditingTable(_ view: AnnotationView, cells: [[String]]) {
        editingView = nil
        editingAnnotationID = nil
        onEditingChange?(false)
        let id = view.annotation.id
        let previous = changeSnapshot ?? notes.annotations
        changeSnapshot = nil
        var updated = notes.annotations
        guard let index = updated.firstIndex(where: { $0.id == id }) else { return }
        if updated[index].cells == cells, updated[index].frame == view.frame { return }
        updated[index].cells = cells
        updated[index].frame = view.frame
        commitAnnotations(updated, previous: previous, name: "Tabelle")
    }

    // The keyboard

    /// The keyboard covers the bottom of the pages: they get room to scroll above it, and the text being typed in
    /// scrolls into view. The page view itself keeps its size, so nothing is zoomed or recycled by the keyboard.
    @objc private func keyboardChanged(_ notification: Notification) {
        var inset: CGFloat = 0
        if notification.name == UIResponder.keyboardWillChangeFrameNotification,
           let end = (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue,
           let window = container.window {
            let local = container.convert(end, from: window.screen.coordinateSpace)
            inset = max(0, container.bounds.maxY - max(local.minY, container.bounds.minY))
        }
        keyboardInset = inset
        guard let scroll = pageScrollView else { return }
        scroll.contentInset.bottom = inset
        scroll.verticalScrollIndicatorInsets.bottom = inset
        revealEditing()
    }

    private var pageScrollView: UIScrollView? {
        container.pdfView.subviews.compactMap { $0 as? UIScrollView }.first
    }

    /// Scrolls so the text or table being typed in is above the keyboard.
    private func revealEditing() {
        guard keyboardInset > 0 || editingView != nil, let view = editingView, let scroll = pageScrollView else { return }
        DispatchQueue.main.async { [weak view, weak scroll] in
            guard let view, let scroll, view.superview != nil else { return }
            let rect = scroll.convert(view.bounds, from: view).insetBy(dx: 0, dy: -24)
            scroll.scrollRectToVisible(rect, animated: true)
        }
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
        lassoClear()
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
        if tool == .math {
            guard let overlay = overlays[region.pageIndex] else { return }
            let frame = overlay.convert(rect, from: container).intersection(overlay.bounds)
            guard !frame.isNull, let image = region.imageJPEG else { return }
            onMathRegion?(MathRegionRequest(page: region.pageIndex, frame: frame, imageJPEG: image))
            container.markingView.clearSelection()
            return
        }
        onMark?(region)
    }

    // Calculating in notes

    /// When the newest two strokes form an "=", the line before it is read once the pen has rested a moment.
    private func watchForEquals(on page: Int, drawing: PKDrawing) {
        pendingMathCheck?.cancel()
        let strokes = drawing.strokes
        guard strokes.count >= 3 else { return }
        let last = strokes[strokes.count - 1].renderBounds
        let before = strokes[strokes.count - 2].renderBounds
        guard MathNotes.isEqualsSign(before, last) else { return }
        let equals = before.union(last)
        let count = strokes.count
        let work = DispatchWorkItem { [weak self] in
            self?.readLine(on: page, equals: equals, strokeCount: count)
        }
        pendingMathCheck = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9, execute: work)
    }

    private func readLine(on page: Int, equals: CGRect, strokeCount: Int) {
        let drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        // Written on since: the "=" was part of something else.
        guard drawing.strokes.count == strokeCount else { return }
        let boxes = drawing.strokes.dropLast(2).map(\.renderBounds)
        guard let line = MathNotes.lineRegion(of: equals, among: Array(boxes)) else { return }
        // The line with the "=" and what is written above it, where values may be defined.
        let width = overlays[page]?.bounds.width ?? line.maxX + 40
        let context = CGRect(x: 0, y: max(0, line.minY - 500), width: max(width, equals.maxX + 20), height: 0)
            .union(CGRect(x: 0, y: line.minY, width: equals.maxX + 20, height: max(line.maxY, equals.maxY) - line.minY + 8))
        guard let image = inkImage(drawing, in: context) else { return }
        onMathLine?(MathLineRequest(page: page, equals: equals, line: line, imageJPEG: image))
    }

    /// Ink only, dark on white, as a model reads it best.
    private func inkImage(_ drawing: PKDrawing, in rect: CGRect) -> Data? {
        guard rect.width > 1, rect.height > 1 else { return nil }
        let scale = min(2, 1600 / max(rect.width, rect.height))
        var ink: UIImage?
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
            ink = drawing.image(from: rect, scale: scale)
        }
        guard let ink else { return nil }
        let image = UIGraphicsImageRenderer(size: rect.size).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: rect.size))
            ink.draw(in: CGRect(origin: .zero, size: rect.size))
        }
        return image.jpegData(compressionQuality: 0.85)
    }

    /// Offers a result right of the "=", as a button on the page; tapping it writes the result there.
    func showMathPreview(_ text: String, page: Int, equals: CGRect, line: CGRect) {
        let size = MathNotes.fontSize(for: line)
        let origin = MathNotes.resultOrigin(after: equals, line: line)
        mathPreview = (page, text, origin, size)
        overlays[page]?.showMathChip(text, at: CGPoint(x: origin.x, y: equals.midY)) { [weak self] in
            self?.acceptMathPreview()
        }
    }

    func hideMathPreview() {
        guard let preview = mathPreview else { return }
        mathPreview = nil
        overlays[preview.page]?.showMathChip(nil, at: .zero, onTap: nil)
    }

    private func acceptMathPreview() {
        guard let preview = mathPreview else { return }
        hideMathPreview()
        writeResult(preview.text, page: preview.page, origin: preview.origin, size: preview.size)
    }

    /// Writes text in the handwriting font and the pen's color, as one step that can be undone.
    func writeResult(_ text: String, page: Int, origin: CGPoint, size: CGFloat) {
        let font = NoteTextStyle.handwriting.font(size: size)
        let width = (text as NSString).size(withAttributes: [.font: font]).width + 16
        var annotation = PageAnnotation(
            page: page,
            kind: .text,
            x: origin.x,
            y: origin.y,
            width: width,
            height: size * 1.6 + 8,
            text: text,
            style: .handwriting,
            color: settings.penColor
        )
        annotation.fontSize = size
        commitAnnotations(notes.annotations + [annotation], previous: notes.annotations, name: "Ergebnis")
    }

    /// A picture placed below a marked region, at most as wide as the page allows.
    func insertImage(_ image: UIImage, below frame: CGRect, page: Int) {
        guard let name = MaterialStore.saveNoteImage(image) else { return }
        let pageSize = overlays[page]?.bounds.size ?? notes.canvasSizes[page] ?? CGSize(width: 595, height: 842)
        let width = min(max(frame.width, pageSize.width * 0.45), pageSize.width - 24)
        let height = width * image.size.height / max(image.size.width, 1)
        let x = min(max(12, frame.minX), pageSize.width - width - 12)
        let y = min(frame.maxY + 10, max(0, pageSize.height - height))
        var annotation = PageAnnotation(page: page, kind: .image, x: x, y: y, width: width, height: height)
        annotation.image = name
        commitAnnotations(notes.annotations + [annotation], previous: notes.annotations, name: "Einfügen")
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

// MARK: - Selection lasso

extension NotesController {
    /// Takes in the ink, texts, pictures and stickers a loop encloses; nil when the loop is too small to mean anything.
    func lassoSelect(page: Int, loop: [CGPoint]) -> LassoResult? {
        let drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        var indices: [Int] = []
        var box = CGRect.null
        for (index, stroke) in drawing.strokes.enumerated() {
            let points = stroke.path.map { $0.location.applying(stroke.transform) }
            if LassoGeometry.share(of: points, inside: loop) >= 0.5 {
                indices.append(index)
                box = box.union(stroke.renderBounds)
            }
        }
        var ids: [String] = []
        for note in notes.annotations(on: page) where LassoGeometry.selects(loop, rect: note.frame) {
            ids.append(note.id)
            box = box.union(note.frame)
        }
        let hasObjects = !indices.isEmpty || !ids.isEmpty
        if !hasObjects { box = LassoGeometry.bounds(of: loop) }
        let rect = LassoGeometry.padded(box, by: 6, within: CGRect(origin: .zero, size: pageCanvasSize(page)))
        guard !rect.isNull, rect.width > 4, rect.height > 4 else { return nil }
        lasso = LassoState(page: page, strokeIndices: indices, strokeCount: drawing.strokes.count, annotationIDs: ids, bounds: rect)
        return LassoResult(rect: rect, hasObjects: hasObjects)
    }

    func lassoClear() {
        if lasso?.original != nil { lassoCancelMove() }
        lasso = nil
        overlays.values.forEach { $0.lassoLayer.hideSelection() }
    }

    /// Sets a page's ink on the canvas only: no history, nothing saved. For the moment a selection is dragged.
    private func setCanvasDrawing(_ drawing: PKDrawing, page: Int) {
        guard let canvas = overlays[page]?.canvas else { return }
        isReplacingDrawing = true
        canvas.drawing = drawing
        isReplacingDrawing = false
    }

    /// Picks the selection up: its ink leaves the canvas as a picture that moves with the finger, and the frames of
    /// its objects are remembered.
    func lassoLift() -> (image: UIImage?, rect: CGRect)? {
        guard var state = lasso, state.original == nil else { return nil }
        let page = state.page
        let drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        guard drawing.strokes.count == state.strokeCount else {
            lassoClear()
            return nil
        }
        state.original = drawing
        for note in notes.annotations where state.annotationIDs.contains(note.id) {
            state.startFrames[note.id] = note.frame
        }
        var image: UIImage?
        var rect = CGRect.zero
        if !state.strokeIndices.isEmpty {
            let strokes = state.strokeIndices.map { drawing.strokes[$0] }
            state.lifted = strokes
            let liftedDrawing = PKDrawing(strokes: strokes)
            rect = liftedDrawing.bounds.insetBy(dx: -2, dy: -2)
            UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
                image = liftedDrawing.image(from: rect, scale: UIScreen.main.scale * 2)
            }
            var rest = drawing.strokes
            for index in state.strokeIndices.sorted(by: >) { rest.remove(at: index) }
            setCanvasDrawing(PKDrawing(strokes: rest), page: page)
        }
        lasso = state
        return (image, rect)
    }

    /// The pictures, texts and stickers of the selection follow the finger.
    func lassoMove(by translation: CGPoint) {
        guard let state = lasso, let overlay = overlays[state.page] else { return }
        for id in state.annotationIDs {
            if let start = state.startFrames[id] {
                overlay.annotationViews[id]?.frame = start.offsetBy(dx: translation.x, dy: translation.y)
            }
        }
    }

    /// Puts the selection down: ink and objects move together, as one step of the history.
    func lassoDrop(by translation: CGPoint) {
        guard var state = lasso, let original = state.original else { return }
        let page = state.page
        if !state.lifted.isEmpty {
            // Back to the ink as it was without a trace, then the move as one undoable change.
            setCanvasDrawing(original, page: page)
            var strokes = original.strokes
            for index in state.strokeIndices.sorted(by: >) { strokes.remove(at: index) }
            let moved = PKDrawing(strokes: state.lifted)
                .transformed(using: CGAffineTransform(translationX: translation.x, y: translation.y))
                .strokes
            let first = strokes.count
            strokes.append(contentsOf: moved)
            setDrawing(PKDrawing(strokes: strokes), page: page)
            state.strokeIndices = Array(first..<strokes.count)
            state.strokeCount = strokes.count
        }
        if !state.annotationIDs.isEmpty {
            var updated = notes.annotations
            for index in updated.indices {
                if let start = state.startFrames[updated[index].id] {
                    updated[index].frame = start.offsetBy(dx: translation.x, dy: translation.y)
                }
            }
            commitAnnotations(updated, previous: notes.annotations, name: "Verschieben")
        }
        state.bounds = state.bounds.offsetBy(dx: translation.x, dy: translation.y)
        state.original = nil
        state.lifted = []
        state.startFrames = [:]
        lasso = state
    }

    func lassoCancelMove() {
        guard var state = lasso, let original = state.original else { return }
        setCanvasDrawing(original, page: state.page)
        if let overlay = overlays[state.page] {
            for (id, frame) in state.startFrames { overlay.annotationViews[id]?.frame = frame }
        }
        state.original = nil
        state.lifted = []
        state.startFrames = [:]
        lasso = state
    }

    func lassoDelete() {
        guard let state = lasso else { return }
        let page = state.page
        var drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        if !state.strokeIndices.isEmpty, drawing.strokes.count == state.strokeCount {
            var strokes = drawing.strokes
            for index in state.strokeIndices.sorted(by: >) { strokes.remove(at: index) }
            drawing = PKDrawing(strokes: strokes)
            setDrawing(drawing, page: page)
        }
        if !state.annotationIDs.isEmpty {
            commitAnnotations(notes.annotations.filter { !state.annotationIDs.contains($0.id) }, previous: notes.annotations, name: "Löschen")
        }
        lassoClear()
    }

    func lassoDuplicate() {
        guard var state = lasso else { return }
        let page = state.page
        let offset: CGFloat = 24
        if !state.strokeIndices.isEmpty {
            var drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
            guard drawing.strokes.count == state.strokeCount else {
                lassoClear()
                return
            }
            let copies = PKDrawing(strokes: state.strokeIndices.map { drawing.strokes[$0] })
                .transformed(using: CGAffineTransform(translationX: offset, y: offset))
                .strokes
            let first = drawing.strokes.count
            drawing.strokes.append(contentsOf: copies)
            setDrawing(drawing, page: page)
            state.strokeIndices = Array(first..<drawing.strokes.count)
            state.strokeCount = drawing.strokes.count
        }
        if !state.annotationIDs.isEmpty {
            var copies: [PageAnnotation] = []
            for id in state.annotationIDs {
                guard var copy = notes.annotations.first(where: { $0.id == id }) else { continue }
                copy.id = UUID().uuidString
                copy.x += offset
                copy.y += offset
                copies.append(copy)
            }
            commitAnnotations(notes.annotations + copies, previous: notes.annotations, name: "Duplizieren")
            state.annotationIDs = copies.map(\.id)
        }
        state.bounds = state.bounds.offsetBy(dx: offset, dy: offset)
        lasso = state
        overlays[page]?.lassoLayer.show(LassoResult(rect: state.bounds, hasObjects: true))
    }

    // Screenshot

    /// The page as it looks in a region, with the PDF, texts, pictures and ink, as a picture.
    func snapshotImage(page: Int, rect: CGRect, scale: CGFloat = 3) -> UIImage? {
        guard let pdfPage = document.page(at: page), rect.width > 1, rect.height > 1 else { return nil }
        let canvas = pageCanvasSize(page)
        let box = pdfPage.bounds(for: .cropBox)
        let drawing = overlays[page]?.canvas.drawing ?? drawings[page] ?? PKDrawing()
        let annotations = notes.annotations(on: page)
        let format = UIGraphicsImageRendererFormat()
        format.scale = scale
        format.opaque = true
        return UIGraphicsImageRenderer(size: rect.size, format: format).image { context in
            let cg = context.cgContext
            UIColor.white.setFill()
            cg.fill(CGRect(origin: .zero, size: rect.size))
            cg.translateBy(x: -rect.minX, y: -rect.minY)
            cg.saveGState()
            cg.scaleBy(x: canvas.width / box.width, y: canvas.height / box.height)
            cg.translateBy(x: 0, y: box.height)
            cg.scaleBy(x: 1, y: -1)
            pdfPage.draw(with: .cropBox, to: cg)
            cg.restoreGState()
            NotesExporter.drawAnnotations(annotations)
            if !drawing.strokes.isEmpty {
                UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
                    drawing.image(from: rect, scale: scale).draw(in: rect)
                }
            }
        }
    }

    /// Takes a picture of the framed region and asks what to do with it: put it on the page, copy or share it.
    func lassoScreenshot(page: Int, rect: CGRect, from source: UIView) {
        guard let image = snapshotImage(page: page, rect: rect) else { return }
        let sheet = UIAlertController(title: "Screenshot", message: nil, preferredStyle: .actionSheet)
        sheet.addAction(UIAlertAction(title: "Als Bild auf die Seite", style: .default) { [weak self] _ in
            self?.insertScreenshot(image, of: rect, page: page)
        })
        sheet.addAction(UIAlertAction(title: "Kopieren", style: .default) { _ in
            UIPasteboard.general.image = image
        })
        sheet.addAction(UIAlertAction(title: "Teilen oder sichern …", style: .default) { [weak self] _ in
            let share = UIActivityViewController(activityItems: [image], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = source
            share.popoverPresentationController?.sourceRect = source.bounds
            self?.presenter()?.present(share, animated: true)
        })
        sheet.addAction(UIAlertAction(title: "Abbrechen", style: .cancel))
        sheet.popoverPresentationController?.sourceView = source
        sheet.popoverPresentationController?.sourceRect = source.bounds
        presenter()?.present(sheet, animated: true)
    }

    /// The screenshot as a picture beside the region, or below it, at the size it was taken.
    private func insertScreenshot(_ image: UIImage, of rect: CGRect, page: Int) {
        guard let name = MaterialStore.saveNoteImage(image) else { return }
        let size = pageCanvasSize(page)
        var origin = CGPoint(x: rect.minX, y: rect.maxY + 12)
        if origin.y + rect.height > size.height {
            origin = CGPoint(x: rect.maxX + 12, y: rect.minY)
        }
        origin.x = min(max(0, origin.x), max(0, size.width - rect.width))
        origin.y = min(max(0, origin.y), max(0, size.height - rect.height))
        var annotation = PageAnnotation(page: page, kind: .image, x: origin.x, y: origin.y, width: rect.width, height: rect.height)
        annotation.image = name
        commitAnnotations(notes.annotations + [annotation], previous: notes.annotations, name: "Screenshot")
    }

    private func presenter() -> UIViewController? {
        var top = container.window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
